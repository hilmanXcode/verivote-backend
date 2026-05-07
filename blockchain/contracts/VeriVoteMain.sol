// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VoterRegistry.sol";

/**
 * @title VeriVoteMain
 * @dev Main smart contract for the VeriVote e-voting system.
 *      Handles election creation, candidate management, vote casting,
 *      and transparent result tallying on the blockchain.
 *
 *      Election lifecycle: Draft → Ongoing → Completed
 *      Votes are immutable and transparent once cast.
 */
contract VeriVoteMain {
    // ============ Enums ============
    enum ElectionStatus { Draft, Ongoing, Completed }

    // ============ Structs ============
    struct Candidate {
        uint256 id;
        string name;
        string description;
        string imageHash;     // IPFS hash for candidate photo
        uint256 voteCount;
    }

    struct Election {
        uint256 id;
        string title;
        string description;
        ElectionStatus status;
        address createdBy;
        uint256 createdAt;
        uint256 startDate;
        uint256 endDate;
        uint256 totalVoters;   // eligible voters
        uint256 totalVotes;    // actual votes cast
        uint256 candidateCount;
    }

    struct VoteRecord {
        address voter;
        uint256 candidateId;
        uint256 timestamp;
        bytes32 voteHash;      // hash for verification
    }

    // ============ State Variables ============
    VoterRegistry public voterRegistry;
    address public owner;
    
    uint256 public electionCount;
    
    // electionId => Election
    mapping(uint256 => Election) public elections;
    
    // electionId => candidateId => Candidate
    mapping(uint256 => mapping(uint256 => Candidate)) public candidates;
    
    // electionId => voter address => has voted
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    
    // electionId => voter address => VoteRecord
    mapping(uint256 => mapping(address => VoteRecord)) public voteRecords;
    
    // electionId => all vote records (for transparency)
    mapping(uint256 => VoteRecord[]) public electionVotes;

    // ============ Events ============
    event ElectionCreated(uint256 indexed electionId, string title, address createdBy);
    event ElectionStarted(uint256 indexed electionId, uint256 startDate, uint256 endDate);
    event ElectionEnded(uint256 indexed electionId, uint256 totalVotes);
    event CandidateAdded(uint256 indexed electionId, uint256 candidateId, string name);
    event VoteCast(uint256 indexed electionId, address indexed voter, bytes32 voteHash, uint256 timestamp);
    event ElectionStatusChanged(uint256 indexed electionId, ElectionStatus oldStatus, ElectionStatus newStatus);

    // ============ Modifiers ============
    modifier onlyOwner() {
        require(msg.sender == owner, "VeriVote: caller is not the owner");
        _;
    }

    modifier onlyAdmin() {
        require(
            msg.sender == owner || 
            voterRegistry.getVoterRole(msg.sender) == VoterRegistry.Role.Admin,
            "VeriVote: caller is not an admin"
        );
        _;
    }

    modifier onlyRegisteredVoter() {
        require(
            voterRegistry.isRegistered(msg.sender),
            "VeriVote: caller is not a registered voter"
        );
        _;
    }

    modifier electionExists(uint256 _electionId) {
        require(_electionId > 0 && _electionId <= electionCount, "VeriVote: election does not exist");
        _;
    }

    // ============ Constructor ============
    constructor(address _voterRegistryAddress) {
        owner = msg.sender;
        voterRegistry = VoterRegistry(_voterRegistryAddress);
    }

    // ============ Election Management ============

    /**
     * @dev Create a new election. Only admin can create.
     * @param _title Title of the election
     * @param _description Description of the election
     * @param _totalVoters Number of eligible voters
     */
    function createElection(
        string memory _title,
        string memory _description,
        uint256 _totalVoters
    ) external onlyAdmin returns (uint256) {
        require(bytes(_title).length > 0, "VeriVote: title cannot be empty");

        electionCount++;
        
        elections[electionCount] = Election({
            id: electionCount,
            title: _title,
            description: _description,
            status: ElectionStatus.Draft,
            createdBy: msg.sender,
            createdAt: block.timestamp,
            startDate: 0,
            endDate: 0,
            totalVoters: _totalVoters,
            totalVotes: 0,
            candidateCount: 0
        });

        emit ElectionCreated(electionCount, _title, msg.sender);
        return electionCount;
    }


    /**
 * @dev Tambahkan banyak kandidat sekaligus untuk menghemat gas dan menghindari masalah nonce.
 */
/**
 * @dev Menambahkan banyak kandidat dalam satu transaksi (Batch).
 * Sangat disarankan untuk menghindari masalah nonce dan menghemat gas.
 */
    function addCandidatesBatch(
        uint256 _electionId,
        string[] memory _names,
        string[] memory _descriptions,
        string[] memory _imageHashes
    ) external onlyAdmin electionExists(_electionId) {
        require(
            _names.length == _descriptions.length && _names.length == _imageHashes.length,
            "VeriVote: arrays length mismatch"
        );
        
        Election storage election = elections[_electionId];
        require(election.status == ElectionStatus.Draft, "VeriVote: election is not in draft");

        for (uint256 i = 0; i < _names.length; i++) {
            election.candidateCount++;
            uint256 candidateId = election.candidateCount;

            candidates[_electionId][candidateId] = Candidate({
                id: candidateId,
                name: _names[i],
                description: _descriptions[i],
                imageHash: _imageHashes[i],
                voteCount: 0
            });

            emit CandidateAdded(_electionId, candidateId, _names[i]);
        }
    }

    /**
     * @dev Add a candidate to an election. Only in Draft status.
     */
    function addCandidate(
        uint256 _electionId,
        string memory _name,
        string memory _description,
        string memory _imageHash
    ) external onlyAdmin electionExists(_electionId) returns (uint256) {
        Election storage election = elections[_electionId];
        require(election.status == ElectionStatus.Draft, "VeriVote: election is not in draft");
        require(bytes(_name).length > 0, "VeriVote: candidate name cannot be empty");

        election.candidateCount++;
        uint256 candidateId = election.candidateCount;

        candidates[_electionId][candidateId] = Candidate({
            id: candidateId,
            name: _name,
            description: _description,
            imageHash: _imageHash,
            voteCount: 0
        });

        emit CandidateAdded(_electionId, candidateId, _name);
        return candidateId;
    }

    /**
     * @dev Start an election. Transitions from Draft to Ongoing.
     * @param _electionId Election ID
     * @param _durationInSeconds Duration of the election in seconds
     */
    function startElection(
        uint256 _electionId,
        uint256 _durationInSeconds
    ) external onlyAdmin electionExists(_electionId) {
        Election storage election = elections[_electionId];
        require(election.status == ElectionStatus.Draft, "VeriVote: election is not in draft");
        require(election.candidateCount >= 2, "VeriVote: need at least 2 candidates");
        require(_durationInSeconds > 0, "VeriVote: duration must be positive");

        election.status = ElectionStatus.Ongoing;
        election.startDate = block.timestamp;
        election.endDate = block.timestamp + _durationInSeconds;

        emit ElectionStarted(_electionId, election.startDate, election.endDate);
        emit ElectionStatusChanged(_electionId, ElectionStatus.Draft, ElectionStatus.Ongoing);
    }

    /**
     * @dev End an election. Can be called by admin or automatically when time expires.
     */
    function endElection(uint256 _electionId) external onlyAdmin electionExists(_electionId) {
        Election storage election = elections[_electionId];
        require(election.status == ElectionStatus.Ongoing, "VeriVote: election is not ongoing");

        election.status = ElectionStatus.Completed;

        emit ElectionEnded(_electionId, election.totalVotes);
        emit ElectionStatusChanged(_electionId, ElectionStatus.Ongoing, ElectionStatus.Completed);
    }

    // ============ Voting ============

    /**
     * @dev Cast a vote. Each registered voter can vote once per election.
     *      The vote is recorded on-chain with a verification hash.
     * @param _electionId Election to vote in
     * @param _candidateId Candidate to vote for
     */
    function castVote(
        uint256 _electionId,
        uint256 _candidateId
    ) external onlyRegisteredVoter electionExists(_electionId) {
        Election storage election = elections[_electionId];
        
        require(election.status == ElectionStatus.Ongoing, "VeriVote: election is not ongoing");
        require(block.timestamp <= election.endDate, "VeriVote: election has ended");
        require(!hasVoted[_electionId][msg.sender], "VeriVote: already voted");
        require(
            _candidateId > 0 && _candidateId <= election.candidateCount,
            "VeriVote: invalid candidate"
        );

    // Generate vote hash for verification
        bytes32 voteHash = keccak256(
            abi.encodePacked(msg.sender, _electionId, _candidateId, block.timestamp)
        );

        // Record the vote
        hasVoted[_electionId][msg.sender] = true;
        candidates[_electionId][_candidateId].voteCount++;
        election.totalVotes++;

        VoteRecord memory record = VoteRecord({
            voter: msg.sender,
            candidateId: _candidateId,
            timestamp: block.timestamp,
            voteHash: voteHash
        });

        voteRecords[_electionId][msg.sender] = record;
        electionVotes[_electionId].push(record);

        emit VoteCast(_electionId, msg.sender, voteHash, block.timestamp);
    }

    /**
     * @dev Cast a vote on behalf of a voter. Only Admin can do this.
     *      Used for API-mediated voting where the backend pays the gas.
     */
    function castVoteByAdmin(
        uint256 _electionId,
        uint256 _candidateId,
        address _voter
    ) external onlyAdmin electionExists(_electionId) {
        Election storage election = elections[_electionId];
        
        require(election.status == ElectionStatus.Ongoing, "VeriVote: election is not ongoing");
        require(block.timestamp <= election.endDate, "VeriVote: election has ended");
        require(voterRegistry.isRegistered(_voter), "VeriVote: voter is not registered");
        require(!hasVoted[_electionId][_voter], "VeriVote: already voted");
        require(
            _candidateId > 0 && _candidateId <= election.candidateCount,
            "VeriVote: invalid candidate"
        );

        bytes32 voteHash = keccak256(
            abi.encodePacked(_voter, _electionId, _candidateId, block.timestamp)
        );

        hasVoted[_electionId][_voter] = true;
        candidates[_electionId][_candidateId].voteCount++;
        election.totalVotes++;

        VoteRecord memory record = VoteRecord({
            voter: _voter,
            candidateId: _candidateId,
            timestamp: block.timestamp,
            voteHash: voteHash
        });

        voteRecords[_electionId][_voter] = record;
        electionVotes[_electionId].push(record);

        emit VoteCast(_electionId, _voter, voteHash, block.timestamp);
    }

    // ============ View Functions ============

    /**
     * @dev Get election details by ID.
     */
    function getElection(uint256 _electionId) 
        external view 
        electionExists(_electionId) 
        returns (Election memory) 
    {
        return elections[_electionId];
    }

    /**
     * @dev Get a candidate's details.
     */
    function getCandidate(uint256 _electionId, uint256 _candidateId) 
        external view 
        electionExists(_electionId) 
        returns (Candidate memory) 
    {
        require(
            _candidateId > 0 && _candidateId <= elections[_electionId].candidateCount,
            "VeriVote: invalid candidate"
        );
        return candidates[_electionId][_candidateId];
    }

    /**
     * @dev Get all candidates for an election.
     */
    function getAllCandidates(uint256 _electionId) 
        external view 
        electionExists(_electionId) 
        returns (Candidate[] memory) 
    {
        uint256 count = elections[_electionId].candidateCount;
        Candidate[] memory result = new Candidate[](count);
        
        for (uint256 i = 1; i <= count; i++) {
            result[i - 1] = candidates[_electionId][i];
        }
        
        return result;
    }

    /**
     * @dev Get election results - returns candidates sorted by vote count (descending).
     *      Only available after election is completed.
     */
    function getElectionResults(uint256 _electionId) 
        external view 
        electionExists(_electionId) 
        returns (Candidate[] memory) 
    {
        Election memory election = elections[_electionId];
        require(
            election.status == ElectionStatus.Completed,
            "VeriVote: election not yet completed"
        );

        uint256 count = election.candidateCount;
        Candidate[] memory result = new Candidate[](count);
        
        for (uint256 i = 1; i <= count; i++) {
            result[i - 1] = candidates[_electionId][i];
        }

        // Sort by voteCount descending (bubble sort for small arrays)
        for (uint256 i = 0; i < count; i++) {
            for (uint256 j = i + 1; j < count; j++) {
                if (result[j].voteCount > result[i].voteCount) {
                    Candidate memory temp = result[i];
                    result[i] = result[j];
                    result[j] = temp;
                }
            }
        }

        return result;
    }

    /**
     * @dev Check if a voter has voted in a specific election.
     */
    function hasVoterVoted(uint256 _electionId, address _voter) 
        external view 
        returns (bool) 
    {
        return hasVoted[_electionId][_voter];
    }

    /**
     * @dev Get vote verification hash for a voter.
     */
    function getVoteVerification(uint256 _electionId, address _voter) 
        external view 
        returns (bytes32) 
    {
        require(hasVoted[_electionId][_voter], "VeriVote: voter has not voted");
        return voteRecords[_electionId][_voter].voteHash;
    }

    /**
     * @dev Get total votes for an election.
     */
    function getElectionVoteCount(uint256 _electionId) 
        external view 
        electionExists(_electionId) 
        returns (uint256) 
    {
        return elections[_electionId].totalVotes;
    }

    /**
     * @dev Check if an election is currently active (ongoing and within time).
     */
    function isElectionActive(uint256 _electionId) 
        external view 
        electionExists(_electionId) 
        returns (bool) 
    {
        Election memory election = elections[_electionId];
        return election.status == ElectionStatus.Ongoing && block.timestamp <= election.endDate;
    }

    /**
     * @dev Get participation rate for an election (percentage * 100 for precision).
     */
    function getParticipationRate(uint256 _electionId) 
        external view 
        electionExists(_electionId) 
        returns (uint256) 
    {
        Election memory election = elections[_electionId];
        if (election.totalVoters == 0) return 0;
        return (election.totalVotes * 10000) / election.totalVoters; // basis points
    }

    /**
     * @dev Get all elections count.
     */
    function getElectionCount() external view returns (uint256) {
        return electionCount;
    }
}
