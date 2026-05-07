// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VoterRegistry
 * @dev Manages voter registration and verification for the VeriVote e-voting system.
 *      Each voter is identified by their NIM (Nomor Induk Mahasiswa / Student ID).
 */
contract VoterRegistry {
    // ============ Enums ============
    enum Role { User, Operator, Admin }

    // ============ Structs ============
    struct Voter {
        string nim;
        string name;
        Role role;
        bool isRegistered;
        uint256 registeredAt;
    }

    // ============ State Variables ============
    address public owner;
    uint256 public totalVoters;
    
    // wallet address => Voter
    mapping(address => Voter) public voters;
    
    // NIM => wallet address (to prevent duplicate NIM registration)
    mapping(string => address) public nimToAddress;
    
    // Track all registered addresses
    address[] public voterAddresses;

    // ============ Events ============
    event VoterRegistered(address indexed voterAddress, string nim, string name, Role role);
    event VoterRoleUpdated(address indexed voterAddress, Role oldRole, Role newRole);
    event VoterRemoved(address indexed voterAddress, string nim);

    // ============ Modifiers ============
    modifier onlyOwner() {
        require(msg.sender == owner, "VoterRegistry: caller is not the owner");
        _;
    }

    modifier onlyAdmin() {
        require(
            msg.sender == owner || voters[msg.sender].role == Role.Admin,
            "VoterRegistry: caller is not an admin"
        );
        _;
    }

    modifier onlyRegistered() {
        require(voters[msg.sender].isRegistered, "VoterRegistry: caller is not registered");
        _;
    }

    // ============ Constructor ============
    constructor() {
        owner = msg.sender;
    }

    // ============ Registration Functions ============

    /**
     * @dev Register a new voter. Only callable by admin or owner.
     * @param _voterAddress Wallet address of the voter
     * @param _nim Student ID (NIM)
     * @param _name Full name of the voter
     * @param _role Role assignment (0=User, 1=Operator, 2=Admin)
     */
    function registerVoter(
        address _voterAddress,
        string memory _nim,
        string memory _name,
        Role _role
    ) external onlyAdmin {
        require(!voters[_voterAddress].isRegistered, "VoterRegistry: voter already registered");
        require(bytes(_nim).length > 0, "VoterRegistry: NIM cannot be empty");
        require(bytes(_name).length > 0, "VoterRegistry: name cannot be empty");
        require(nimToAddress[_nim] == address(0), "VoterRegistry: NIM already registered");

        voters[_voterAddress] = Voter({
            nim: _nim,
            name: _name,
            role: _role,
            isRegistered: true,
            registeredAt: block.timestamp
        });

        nimToAddress[_nim] = _voterAddress;
        voterAddresses.push(_voterAddress);
        totalVoters++;

        emit VoterRegistered(_voterAddress, _nim, _name, _role);
    }

    /**
     * @dev Register multiple voters in batch. Gas-efficient for initial setup.
     */
    function batchRegisterVoters(
        address[] memory _addresses,
        string[] memory _nims,
        string[] memory _names,
        Role[] memory _roles
    ) external onlyAdmin {
        require(
            _addresses.length == _nims.length &&
            _nims.length == _names.length &&
            _names.length == _roles.length,
            "VoterRegistry: arrays length mismatch"
        );

        for (uint256 i = 0; i < _addresses.length; i++) {
            if (!voters[_addresses[i]].isRegistered && nimToAddress[_nims[i]] == address(0)) {
                voters[_addresses[i]] = Voter({
                    nim: _nims[i],
                    name: _names[i],
                    role: _roles[i],
                    isRegistered: true,
                    registeredAt: block.timestamp
                });

                nimToAddress[_nims[i]] = _addresses[i];
                voterAddresses.push(_addresses[i]);
                totalVoters++;

                emit VoterRegistered(_addresses[i], _nims[i], _names[i], _roles[i]);
            }
        }
    }

    /**
     * @dev Update a voter's role. Only callable by admin.
     */
    function updateVoterRole(address _voterAddress, Role _newRole) external onlyAdmin {
        require(voters[_voterAddress].isRegistered, "VoterRegistry: voter not registered");
        
        Role oldRole = voters[_voterAddress].role;
        voters[_voterAddress].role = _newRole;
        
        emit VoterRoleUpdated(_voterAddress, oldRole, _newRole);
    }

    /**
     * @dev Remove a voter. Only callable by admin.
     */
    function removeVoter(address _voterAddress) external onlyAdmin {
        require(voters[_voterAddress].isRegistered, "VoterRegistry: voter not registered");
        
        string memory nim = voters[_voterAddress].nim;
        delete nimToAddress[nim];
        delete voters[_voterAddress];
        totalVoters--;

        emit VoterRemoved(_voterAddress, nim);
    }

    // ============ View Functions ============

    function isRegistered(address _address) external view returns (bool) {
        return voters[_address].isRegistered;
    }

    function getVoterByAddress(address _address) external view returns (Voter memory) {
        require(voters[_address].isRegistered, "VoterRegistry: voter not found");
        return voters[_address];
    }

    function getVoterByNim(string memory _nim) external view returns (Voter memory) {
        address voterAddr = nimToAddress[_nim];
        require(voterAddr != address(0), "VoterRegistry: NIM not found");
        return voters[voterAddr];
    }

    function getAddressByNim(string memory _nim) external view returns (address) {
        address voterAddr = nimToAddress[_nim];
        require(voterAddr != address(0), "VoterRegistry: NIM not found");
        return voterAddr;
    }

    function getVoterRole(address _address) external view returns (Role) {
        require(voters[_address].isRegistered, "VoterRegistry: voter not found");
        return voters[_address].role;
    }

    function getAllVoterAddresses() external view returns (address[] memory) {
        return voterAddresses;
    }

    function getVoterCount() external view returns (uint256) {
        return totalVoters;
    }
}
