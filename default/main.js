const roleHarvester = require('role.harvester');
const roleUpgrader  = require('role.upgrader');
const roleBuilder   = require('role.builder');
const roleRepairer  = require('role.repairer');
const roleSoldier   = require('role.soldier');
const roleScout     = require('role.scout');
const roleHealer    = require('role.healer');
const roleHuller    = require('role.huller');
const roleRunner    = require('role.runner');
const LinkManager   = require('linkManager.js');

const remoteRooms = ['E58N42']; // add more as needed

const bodies = {
    harvester: [[WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE],
                [WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,MOVE],
                [WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE],
                [WORK,WORK,CARRY,MOVE,MOVE],
                [WORK,CARRY,MOVE]],
    upgrader:  [[WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,MOVE],
                [WORK,WORK,WORK,WORK,WORK,CARRY,MOVE],
                [WORK,CARRY,MOVE]],
    builder:   [[WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE],
                [WORK,WORK,CARRY,MOVE,MOVE],
                [WORK,CARRY,MOVE]],
    repairer:  [[WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE],
                [WORK,WORK,CARRY,MOVE,MOVE],
                [WORK,CARRY,MOVE]],
    soldier:   [[TOUGH,TOUGH,ATTACK,ATTACK,ATTACK,ATTACK,MOVE,MOVE,MOVE,MOVE],
                [TOUGH,TOUGH,ATTACK,ATTACK,MOVE,MOVE,MOVE],
                [TOUGH,ATTACK,MOVE,MOVE]],
    healer:    [[HEAL,HEAL,HEAL,MOVE,MOVE]],
    huller:    [[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE],
                [CARRY,CARRY,CARRY,CARRY,MOVE,MOVE],
                [CARRY,CARRY,MOVE]],
    runner:    [[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE],
                [CARRY,CARRY,CARRY,CARRY,MOVE,MOVE],
                [CARRY,CARRY,MOVE]]
};

// === Spawn helper ===
function spawnLargestCreep(spawn, role, bodies, memory = {}) {
    if (!bodies || bodies.length === 0) return false;
    const sortedBodies = bodies.slice().sort((a,b) =>
        _.sum(b, p => BODYPART_COST[p]) - _.sum(a, p => BODYPART_COST[p])
    );
    for (const body of sortedBodies) {
        const cost = _.sum(body, p => BODYPART_COST[p]);
        if (spawn.room.energyAvailable >= cost) {
            const name = role + Game.time + Math.floor(Math.random()*1000);
            if (spawn.spawnCreep(body, name, { memory }) === OK) {
                console.log(`⚡ Spawning ${role}: ${name} (cost: ${cost})`);
                return true;
            }
        }
    }
    return false;
}

// === Memory cleanup ===
function cleanMemory() {
    for (let name in Memory.creeps) if (!Game.creeps[name]) delete Memory.creeps[name];
}

// === Room memory setup ===
function setupRoomMemory(room) {
    if (!room.memory.sources || Game.time % 50 === 0)
        room.memory.sources = room.find(FIND_SOURCES).map(s => s.id);
}

// === Spawn harvesters for all rooms ===
function spawnHarvesters(spawn, homeRoom) {
    for (const rName of [homeRoom, ...remoteRooms]) {
        const isHome = rName === homeRoom;
        const room = Game.rooms[rName];
        const rMem = isHome ? room.memory : Memory.rooms[rName];
        if (!rMem) continue;
        const sources = (rMem.sources || []).map(id => Game.getObjectById(id)).filter(Boolean);

        for (let i=0; i<sources.length; i++) {
            const assigned = _.filter(Game.creeps, c =>
                c.memory.role==='harvester' &&
                (isHome ? c.memory.homeRoom : c.memory.targetRoom)===rName &&
                c.memory.sourceIndex===i
            );
            const needed = 3 - assigned.length;
            if (needed>0) {
                const mem = { role:'harvester', homeRoom, targetRoom:rName, sourceIndex:i };
                if (spawnLargestCreep(spawn,'harvester',bodies.harvester,mem)) return false;
            }
        }

        const totalAssigned = _.filter(Game.creeps, c =>
            c.memory.role==='harvester' &&
            (isHome ? c.memory.homeRoom : c.memory.targetRoom)===rName
        ).length;
        if (totalAssigned < sources.length*3) return false;
    }
    return true;
}

// === Spawn all other roles in order ===
function spawnRoles(spawn, homeRoom) {
    // === Hullers (main room only) ===
    const mainRoom = Game.rooms[homeRoom];
    const hullerCount = _.filter(Game.creeps, c=>c.memory.role==='huller' && c.memory.homeRoom===homeRoom).length;
    const hullerMax = (mainRoom.memory.sources||[]).length*2;
    if (hullerCount < hullerMax) {
        if (spawnLargestCreep(spawn,'huller',bodies.huller,{role:'huller',homeRoom})) return;
    }

    // === Upgraders and Runners per room ===
    for (const rName of [homeRoom, ...remoteRooms]) {
        const room = Game.rooms[rName]; if(!room || !room.controller || !room.controller.my) continue;

        // Upgraders
        const upgraders = _.filter(Game.creeps, c=>c.memory.role==='upgrader' && c.memory.targetRoom===rName);
        const targetEnergy = room.controller.level<8?30:15;
        const totalWork = _.sum(upgraders, c=>c.getActiveBodyparts(WORK));
        const missingWork = Math.max(0, targetEnergy-totalWork);
        if (missingWork>0 && upgraders.length<6) {
            const workToUse = Math.min(10, missingWork);
            const body = Array(workToUse).fill(WORK).concat([CARRY,MOVE]);
            if (spawnLargestCreep(spawn,'upgrader',[body],{role:'upgrader',homeRoom,targetRoom:rName})) return;
        }

        // Runners
        const assignedRunners = _.filter(Game.creeps,c=>c.memory.role==='runner' && c.memory.targetRoom===rName);
        if (assignedRunners.length<3) {
            if (spawnLargestCreep(spawn,'runner',bodies.runner,{role:'runner',homeRoom,targetRoom:rName})) return;
        }

        // Repairers
        const assignedRepairers = _.filter(Game.creeps,c=>c.memory.role==='repairer' && c.memory.targetRoom===rName);
        if (assignedRepairers.length<3) {
            if (spawnLargestCreep(spawn,'repairer',bodies.repairer,{role:'repairer',homeRoom,targetRoom:rName})) return;
        }

        // Builders
        const sites = room.find(FIND_CONSTRUCTION_SITES);
        if (sites.length>0) {
            const assignedBuilders = _.filter(Game.creeps,c=>c.memory.role==='builder' && c.memory.targetRoom===rName);
            const maxB = Math.min(6, Math.ceil(sites.length/2));
            if (assignedBuilders.length<maxB)
                if (spawnLargestCreep(spawn,'builder',bodies.builder,{role:'builder',homeRoom,targetRoom:rName})) return;
        }
    }

    // Soldiers and Healers (everything else)
    const soldiers = _.filter(Game.creeps,c=>c.memory.role==='soldier');
    if (soldiers.length<5) spawnLargestCreep(spawn,'soldier',bodies.soldier,{role:'soldier',homeRoom});
    const healers = _.filter(Game.creeps,c=>c.memory.role==='healer');
    if (healers.length<2) spawnLargestCreep(spawn,'healer',bodies.healer,{role:'healer',homeRoom});
}

// === Main loop ===
module.exports.loop = function() {
    const spawn = Game.spawns['Main1'];
    if (!spawn) return;
    const homeRoom = spawn.room.name;

    cleanMemory();
    setupRoomMemory(Game.rooms[homeRoom]);

    // === SPAWN LOGIC ===
    if (!spawn.spawning) {
        const harvestersReady = spawnHarvesters(spawn, homeRoom);
        if (harvestersReady) spawnRoles(spawn, homeRoom);
    }

    // === Run creeps ===
    for(const name in Game.creeps){
        const creep = Game.creeps[name];
        switch(creep.memory.role){
            case 'harvester': roleHarvester.run(creep, spawn); break;
            case 'upgrader':  roleUpgrader.run(creep); break;
            case 'builder':   roleBuilder.run(creep); break;
            case 'repairer':  roleRepairer.run(creep); break;
            case 'soldier':   roleSoldier.run(creep); break;
            case 'scout':     roleScout.run(creep); break;
            case 'healer':    roleHealer.run(creep); break;
            case 'huller':    roleHuller.run(creep); break;
            case 'runner':    roleRunner.run(creep); break;
        }
    }

    // === LINK MANAGER ===
    LinkManager.runAll();

    // === Towers ===
    const room = Game.rooms[homeRoom];
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    const injuredCreeps = room.find(FIND_MY_CREEPS, {filter:c=>c.hits<c.hitsMax});
    const damagedStructures = room.find(FIND_STRUCTURES,{filter:s=>s.hits<s.hitsMax && ![STRUCTURE_WALL,STRUCTURE_RAMPART].includes(s.structureType)});
    for (const tower of room.find(FIND_MY_STRUCTURES,{filter:{structureType:STRUCTURE_TOWER}})) {
        const hostile = tower.pos.findClosestByRange(hostiles);
        if (hostile){ tower.attack(hostile); continue; }
        const injured = tower.pos.findClosestByRange(injuredCreeps);
        if (injured){ tower.heal(injured); continue; }
        const damaged = tower.pos.findClosestByRange(damagedStructures);
        if (damaged) tower.repair(damaged);
    }

    // Pixel
    if(Game.cpu.generatePixel && Game.cpu.bucket>=10000) Game.cpu.generatePixel();
};
