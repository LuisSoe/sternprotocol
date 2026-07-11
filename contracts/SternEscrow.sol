// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SternEscrow is Ownable, Pausable, ReentrancyGuard {
    enum State {
        Pending,
        Verified,
        Completed,
        Refunded,
        Disputed
    }

    struct Verification {
        bool vgmMatch;
        bool aisDeparted;
        bool ceisaApproved;
        bool eblCidValid;
        bool inspectionPassed;
        uint256 submittedAtBlock;
    }

    struct OracleAttestation {
        bool submitted;
        bool vgmMatch;
        bool aisDeparted;
        bool ceisaApproved;
        bool eblCidValid;
        bool inspectionPassed;
    }

    struct Escrow {
        uint256 contractValue;
        address payable exporterAddress;
        address payable importerAddress;
        address arbiterAddress;
        string eBLCID;
        uint256 deadline;
        uint256 createdBlock;
        string commodity;
        string containerRef;
        State state;
        Verification verification;
        uint8 releaseApprovals;
        uint8 refundApprovals;
    }

    // Confirmation depth before release, set once at deployment. Polygon PoS has
    // ~5s deterministic finality since Heimdall v2; this acts as an optional
    // circuit-breaker for finality-lag incidents, not the primary finality source.
    uint256 public immutable requiredConfirmations;

    // Oracle consortium: verification requires agreement from `oracleQuorum`
    // independent bonded oracles. The oracle set is fixed at deployment — the
    // operator cannot swap verifiers after the fact.
    uint256 public immutable oracleQuorum;
    uint256 public immutable oracleBond;
    uint256 public constant SLASH_BPS = 5000; // 50% of remaining bond per deviation

    address[] private oracleList;
    mapping(address => bool) public isOracle;
    mapping(address => uint256) public oracleBonds;
    mapping(address => uint256) public oracleSlashCount;
    uint256 public treasury;

    uint256 public nextEscrowId;

    mapping(uint256 => Escrow) private escrows;
    mapping(uint256 => mapping(address => bool)) public disputeVoted;
    mapping(uint256 => uint256) public pendingDeadline;
    mapping(uint256 => address) public extensionProposer;
    mapping(uint256 => mapping(address => OracleAttestation)) private attestations;
    mapping(uint256 => mapping(address => bool)) public slashedFor;

    event OracleBonded(address indexed oracle, uint256 amount, uint256 totalBond);
    event AttestationSubmitted(
        uint256 indexed escrowId,
        address indexed oracle,
        bool vgmMatch,
        bool aisDeparted,
        bool ceisaApproved,
        bool eblCidValid,
        bool inspectionPassed
    );
    event OracleSlashed(uint256 indexed escrowId, address indexed oracle, uint256 amount);
    event TreasuryWithdrawn(address indexed to, uint256 amount);
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed importer,
        address indexed exporter,
        address arbiter,
        uint256 value,
        string eBLCID,
        string commodity,
        string containerRef,
        uint256 deadline
    );
    event OracleVerificationSubmitted(
        uint256 indexed escrowId,
        bool vgmMatch,
        bool aisDeparted,
        bool ceisaApproved,
        bool eblCidValid,
        bool inspectionPassed
    );
    event FundsReleased(uint256 indexed escrowId, address indexed exporter, uint256 amount);
    event Refunded(uint256 indexed escrowId, address indexed importer, uint256 amount);
    event DisputeOpened(uint256 indexed escrowId, address indexed openedBy);
    event DisputeVote(uint256 indexed escrowId, address indexed voter, bool releaseToExporter);
    event DisputeResolved(uint256 indexed escrowId, bool releasedToExporter);
    event EBLTransferred(uint256 indexed escrowId, string eBLCID, address indexed newHolder);
    event DeadlineExtensionProposed(uint256 indexed escrowId, address indexed proposer, uint256 newDeadline);
    event DeadlineExtended(uint256 indexed escrowId, uint256 newDeadline);

    modifier onlyBondedOracle() {
        require(isOracle[msg.sender], "not consortium oracle");
        require(oracleBonds[msg.sender] >= oracleBond, "oracle bond required");
        _;
    }

    modifier escrowExists(uint256 escrowId) {
        require(escrows[escrowId].importerAddress != address(0), "escrow not found");
        _;
    }

    constructor(
        address initialOwner,
        address[] memory initialOracles,
        uint256 quorum,
        uint256 bondAmount,
        uint256 confirmations
    ) Ownable(initialOwner) {
        require(initialOwner != address(0), "owner zero address");
        require(quorum >= 1, "quorum required");
        require(initialOracles.length >= quorum, "not enough oracles for quorum");
        require(bondAmount > 0, "bond required");
        require(confirmations > 0, "confirmations required");

        for (uint256 i = 0; i < initialOracles.length; i++) {
            address oracle = initialOracles[i];
            require(oracle != address(0), "oracle zero address");
            require(!isOracle[oracle], "duplicate oracle");
            isOracle[oracle] = true;
            oracleList.push(oracle);
        }

        oracleQuorum = quorum;
        oracleBond = bondAmount;
        requiredConfirmations = confirmations;
    }

    function postBond() external payable {
        require(isOracle[msg.sender], "not consortium oracle");
        require(msg.value > 0, "bond value required");
        oracleBonds[msg.sender] += msg.value;
        emit OracleBonded(msg.sender, msg.value, oracleBonds[msg.sender]);
    }

    function createEscrow(
        address payable exporterAddress,
        address arbiterAddress,
        string calldata eBLCID,
        uint256 deadline,
        string calldata commodity,
        string calldata containerRef
    ) external payable whenNotPaused nonReentrant returns (uint256 escrowId) {
        require(msg.value > 0, "escrow value required");
        require(exporterAddress != address(0), "exporter zero address");
        require(arbiterAddress != address(0), "arbiter zero address");
        require(deadline > block.timestamp, "deadline must be future");
        require(bytes(eBLCID).length > 0, "eBL CID required");
        require(bytes(containerRef).length > 0, "container ref required");

        escrowId = nextEscrowId++;
        escrows[escrowId] = Escrow({
            contractValue: msg.value,
            exporterAddress: exporterAddress,
            importerAddress: payable(msg.sender),
            arbiterAddress: arbiterAddress,
            eBLCID: eBLCID,
            deadline: deadline,
            createdBlock: block.number,
            commodity: commodity,
            containerRef: containerRef,
            state: State.Pending,
            verification: Verification({
                vgmMatch: false,
                aisDeparted: false,
                ceisaApproved: false,
                eblCidValid: false,
                inspectionPassed: false,
                submittedAtBlock: 0
            }),
            releaseApprovals: 0,
            refundApprovals: 0
        });

        emit EscrowCreated(
            escrowId,
            msg.sender,
            exporterAddress,
            arbiterAddress,
            msg.value,
            eBLCID,
            commodity,
            containerRef,
            deadline
        );
    }

    function submitAttestation(
        uint256 escrowId,
        bool vgmMatch,
        bool aisDeparted,
        bool ceisaApproved,
        bool eblCidValid,
        bool inspectionPassed
    ) external onlyBondedOracle whenNotPaused nonReentrant escrowExists(escrowId) {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state == State.Pending || escrow.state == State.Verified, "escrow not verifiable");

        attestations[escrowId][msg.sender] = OracleAttestation({
            submitted: true,
            vgmMatch: vgmMatch,
            aisDeparted: aisDeparted,
            ceisaApproved: ceisaApproved,
            eblCidValid: eblCidValid,
            inspectionPassed: inspectionPassed
        });

        emit AttestationSubmitted(
            escrowId,
            msg.sender,
            vgmMatch,
            aisDeparted,
            ceisaApproved,
            eblCidValid,
            inspectionPassed
        );

        _tryFinalize(escrowId);
    }

    function _tryFinalize(uint256 escrowId) private {
        Escrow storage escrow = escrows[escrowId];

        uint256 submittedCount;
        uint256[5] memory trueCounts;

        for (uint256 i = 0; i < oracleList.length; i++) {
            OracleAttestation storage att = attestations[escrowId][oracleList[i]];
            if (!att.submitted) continue;
            submittedCount++;
            if (att.vgmMatch) trueCounts[0]++;
            if (att.aisDeparted) trueCounts[1]++;
            if (att.ceisaApproved) trueCounts[2]++;
            if (att.eblCidValid) trueCounts[3]++;
            if (att.inspectionPassed) trueCounts[4]++;
        }

        if (submittedCount < oracleQuorum) return;

        bool[5] memory consensus;
        for (uint256 i = 0; i < 5; i++) {
            if (trueCounts[i] >= oracleQuorum) {
                consensus[i] = true;
            } else if (submittedCount - trueCounts[i] >= oracleQuorum) {
                consensus[i] = false;
            } else {
                return; // check undecided — wait for more attestations
            }
        }

        escrow.verification = Verification({
            vgmMatch: consensus[0],
            aisDeparted: consensus[1],
            ceisaApproved: consensus[2],
            eblCidValid: consensus[3],
            inspectionPassed: consensus[4],
            submittedAtBlock: block.number
        });

        emit OracleVerificationSubmitted(
            escrowId,
            consensus[0],
            consensus[1],
            consensus[2],
            consensus[3],
            consensus[4]
        );

        _slashDeviants(escrowId, consensus);

        if (_allConditionsMet(escrow) && escrow.state == State.Pending) {
            escrow.state = State.Verified;
        }

        if (_isReleaseEligible(escrow)) {
            _release(escrowId);
        }
    }

    function _slashDeviants(uint256 escrowId, bool[5] memory consensus) private {
        for (uint256 i = 0; i < oracleList.length; i++) {
            address oracle = oracleList[i];
            OracleAttestation storage att = attestations[escrowId][oracle];
            if (!att.submitted || slashedFor[escrowId][oracle]) continue;

            bool deviates = att.vgmMatch != consensus[0]
                || att.aisDeparted != consensus[1]
                || att.ceisaApproved != consensus[2]
                || att.eblCidValid != consensus[3]
                || att.inspectionPassed != consensus[4];
            if (!deviates) continue;

            slashedFor[escrowId][oracle] = true;
            oracleSlashCount[oracle]++;

            uint256 bond = oracleBonds[oracle];
            uint256 amount = (bond * SLASH_BPS) / 10000;
            if (amount > 0) {
                oracleBonds[oracle] = bond - amount;
                treasury += amount;
            }

            emit OracleSlashed(escrowId, oracle, amount);
        }
    }

    function releaseEscrow(uint256 escrowId)
        external
        whenNotPaused
        nonReentrant
        escrowExists(escrowId)
    {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state != State.Completed, "escrow already completed");
        require(escrow.state != State.Refunded, "escrow already refunded");
        require(escrow.state != State.Disputed, "escrow disputed");
        require(_isReleaseEligible(escrow), "conditions not met");
        _release(escrowId);
    }

    function claimRefund(uint256 escrowId)
        external
        whenNotPaused
        nonReentrant
        escrowExists(escrowId)
    {
        Escrow storage escrow = escrows[escrowId];
        require(msg.sender == escrow.importerAddress, "only importer");
        require(escrow.state != State.Completed, "escrow already completed");
        require(escrow.state != State.Refunded, "escrow already refunded");
        require(block.timestamp > escrow.deadline, "deadline not passed");
        _refund(escrowId);
    }

    function openDispute(uint256 escrowId) external whenNotPaused escrowExists(escrowId) {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state == State.Pending || escrow.state == State.Verified, "cannot dispute");
        require(_isParty(escrow, msg.sender), "not escrow party");
        escrow.state = State.Disputed;
        _clearPendingExtension(escrowId);
        emit DisputeOpened(escrowId, msg.sender);
    }

    function voteDisputeResolution(uint256 escrowId, bool releaseToExporter)
        external
        whenNotPaused
        nonReentrant
        escrowExists(escrowId)
    {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state == State.Disputed, "escrow not disputed");
        require(_isParty(escrow, msg.sender), "not escrow party");
        require(!disputeVoted[escrowId][msg.sender], "already voted");

        disputeVoted[escrowId][msg.sender] = true;

        if (releaseToExporter) {
            escrow.releaseApprovals += 1;
        } else {
            escrow.refundApprovals += 1;
        }

        emit DisputeVote(escrowId, msg.sender, releaseToExporter);

        if (escrow.releaseApprovals >= 2) {
            _release(escrowId);
            emit DisputeResolved(escrowId, true);
        } else if (escrow.refundApprovals >= 2) {
            _refund(escrowId);
            emit DisputeResolved(escrowId, false);
        }
    }

    function proposeDeadlineExtension(uint256 escrowId, uint256 newDeadline)
        external
        whenNotPaused
        escrowExists(escrowId)
    {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state == State.Pending || escrow.state == State.Verified, "escrow not amendable");
        require(
            msg.sender == escrow.importerAddress || msg.sender == escrow.exporterAddress,
            "only importer or exporter"
        );
        require(newDeadline > escrow.deadline, "must extend deadline");

        pendingDeadline[escrowId] = newDeadline;
        extensionProposer[escrowId] = msg.sender;
        emit DeadlineExtensionProposed(escrowId, msg.sender, newDeadline);
    }

    function approveDeadlineExtension(uint256 escrowId) external whenNotPaused escrowExists(escrowId) {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state == State.Pending || escrow.state == State.Verified, "escrow not amendable");
        require(
            msg.sender == escrow.importerAddress || msg.sender == escrow.exporterAddress,
            "only importer or exporter"
        );

        uint256 newDeadline = pendingDeadline[escrowId];
        require(newDeadline != 0, "no pending extension");
        require(msg.sender != extensionProposer[escrowId], "proposer cannot approve");

        escrow.deadline = newDeadline;
        _clearPendingExtension(escrowId);
        emit DeadlineExtended(escrowId, newDeadline);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function withdrawTreasury() external onlyOwner nonReentrant {
        uint256 amount = treasury;
        require(amount > 0, "treasury empty");
        treasury = 0;
        (bool sent, ) = payable(owner()).call{value: amount}("");
        require(sent, "treasury transfer failed");
        emit TreasuryWithdrawn(owner(), amount);
    }

    function getEscrow(uint256 escrowId) external view escrowExists(escrowId) returns (Escrow memory) {
        return escrows[escrowId];
    }

    function isReleaseEligible(uint256 escrowId) external view escrowExists(escrowId) returns (bool) {
        return _isReleaseEligible(escrows[escrowId]);
    }

    function getOracles()
        external
        view
        returns (address[] memory addrs, uint256[] memory bonds, uint256[] memory slashes)
    {
        uint256 count = oracleList.length;
        addrs = new address[](count);
        bonds = new uint256[](count);
        slashes = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            addrs[i] = oracleList[i];
            bonds[i] = oracleBonds[oracleList[i]];
            slashes[i] = oracleSlashCount[oracleList[i]];
        }
    }

    function getAttestation(uint256 escrowId, address oracle)
        external
        view
        escrowExists(escrowId)
        returns (OracleAttestation memory)
    {
        return attestations[escrowId][oracle];
    }

    function _clearPendingExtension(uint256 escrowId) private {
        delete pendingDeadline[escrowId];
        delete extensionProposer[escrowId];
    }

    function _release(uint256 escrowId) private {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state != State.Completed, "escrow already completed");
        require(escrow.state != State.Refunded, "escrow already refunded");

        uint256 amount = escrow.contractValue;
        escrow.contractValue = 0;
        escrow.state = State.Completed;
        _clearPendingExtension(escrowId);

        (bool sent, ) = escrow.exporterAddress.call{value: amount}("");
        require(sent, "exporter transfer failed");

        emit FundsReleased(escrowId, escrow.exporterAddress, amount);
        emit EBLTransferred(escrowId, escrow.eBLCID, escrow.importerAddress);
    }

    function _refund(uint256 escrowId) private {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state != State.Completed, "escrow already completed");
        require(escrow.state != State.Refunded, "escrow already refunded");

        uint256 amount = escrow.contractValue;
        escrow.contractValue = 0;
        escrow.state = State.Refunded;
        _clearPendingExtension(escrowId);

        (bool sent, ) = escrow.importerAddress.call{value: amount}("");
        require(sent, "importer transfer failed");

        emit Refunded(escrowId, escrow.importerAddress, amount);
    }

    function _isReleaseEligible(Escrow storage escrow) private view returns (bool) {
        return _allConditionsMet(escrow) && block.number >= escrow.createdBlock + requiredConfirmations;
    }

    function _allConditionsMet(Escrow storage escrow) private view returns (bool) {
        Verification storage verification = escrow.verification;
        return verification.vgmMatch
            && verification.aisDeparted
            && verification.ceisaApproved
            && verification.eblCidValid
            && verification.inspectionPassed;
    }

    function _isParty(Escrow storage escrow, address account) private view returns (bool) {
        return account == escrow.importerAddress
            || account == escrow.exporterAddress
            || account == escrow.arbiterAddress;
    }
}
