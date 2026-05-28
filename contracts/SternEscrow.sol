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
        uint256 submittedAtBlock;
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

    uint256 public constant REQUIRED_CONFIRMATIONS = 128;

    address public trustedOracle;
    uint256 public nextEscrowId;

    mapping(uint256 => Escrow) private escrows;
    mapping(uint256 => mapping(address => bool)) public disputeVoted;

    event TrustedOracleUpdated(address indexed oldOracle, address indexed newOracle);
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
        bool eblCidValid
    );
    event FundsReleased(uint256 indexed escrowId, address indexed exporter, uint256 amount);
    event Refunded(uint256 indexed escrowId, address indexed importer, uint256 amount);
    event DisputeOpened(uint256 indexed escrowId, address indexed openedBy);
    event DisputeVote(uint256 indexed escrowId, address indexed voter, bool releaseToExporter);
    event DisputeResolved(uint256 indexed escrowId, bool releasedToExporter);
    event EBLTransferred(uint256 indexed escrowId, string eBLCID, address indexed newHolder);

    modifier onlyOracle() {
        require(msg.sender == trustedOracle, "not trusted oracle");
        _;
    }

    modifier escrowExists(uint256 escrowId) {
        require(escrows[escrowId].importerAddress != address(0), "escrow not found");
        _;
    }

    constructor(address initialOwner, address initialOracle) Ownable(initialOwner) {
        require(initialOwner != address(0), "owner zero address");
        require(initialOracle != address(0), "oracle zero address");
        trustedOracle = initialOracle;
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

    function submitVerification(
        uint256 escrowId,
        bool vgmMatch,
        bool aisDeparted,
        bool ceisaApproved,
        bool eblCidValid
    ) external onlyOracle whenNotPaused escrowExists(escrowId) {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state == State.Pending || escrow.state == State.Verified, "escrow not verifiable");

        escrow.verification = Verification({
            vgmMatch: vgmMatch,
            aisDeparted: aisDeparted,
            ceisaApproved: ceisaApproved,
            eblCidValid: eblCidValid,
            submittedAtBlock: block.number
        });

        emit OracleVerificationSubmitted(escrowId, vgmMatch, aisDeparted, ceisaApproved, eblCidValid);

        if (_allConditionsMet(escrow) && escrow.state == State.Pending) {
            escrow.state = State.Verified;
        }

        if (_isReleaseEligible(escrow)) {
            _release(escrowId);
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

    function setTrustedOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "oracle zero address");
        address oldOracle = trustedOracle;
        trustedOracle = newOracle;
        emit TrustedOracleUpdated(oldOracle, newOracle);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getEscrow(uint256 escrowId) external view escrowExists(escrowId) returns (Escrow memory) {
        return escrows[escrowId];
    }

    function isReleaseEligible(uint256 escrowId) external view escrowExists(escrowId) returns (bool) {
        return _isReleaseEligible(escrows[escrowId]);
    }

    function _release(uint256 escrowId) private {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state != State.Completed, "escrow already completed");
        require(escrow.state != State.Refunded, "escrow already refunded");

        uint256 amount = escrow.contractValue;
        escrow.contractValue = 0;
        escrow.state = State.Completed;

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

        (bool sent, ) = escrow.importerAddress.call{value: amount}("");
        require(sent, "importer transfer failed");

        emit Refunded(escrowId, escrow.importerAddress, amount);
    }

    function _isReleaseEligible(Escrow storage escrow) private view returns (bool) {
        return _allConditionsMet(escrow) && block.number >= escrow.createdBlock + REQUIRED_CONFIRMATIONS;
    }

    function _allConditionsMet(Escrow storage escrow) private view returns (bool) {
        Verification storage verification = escrow.verification;
        return verification.vgmMatch
            && verification.aisDeparted
            && verification.ceisaApproved
            && verification.eblCidValid;
    }

    function _isParty(Escrow storage escrow, address account) private view returns (bool) {
        return account == escrow.importerAddress
            || account == escrow.exporterAddress
            || account == escrow.arbiterAddress;
    }
}
