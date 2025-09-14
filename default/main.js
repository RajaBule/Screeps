const roleHarvester = require('role.harvester');
const roleUpgrader  = require('role.upgrader');
const roleBuilder   = require('role.builder');
const roleRepairer  = require('role.repairer');
const roleSoldier   = require('role.soldier');
const roleScout     = require('role.scout');
const roleHealer    = require('role.healer');
const roleHuller    = require('role.huller');
const roleRunner    = require('role.runner');
const LinkManager = require('linkManager.js');

// === Remote rooms config ===
const remoteRooms = ['E58N42']; // add more as needed

// === Helper: spawn largest creep we can afford ===
function spawnLargestCreep(spawn, role, bodies, memory = {}) {
    if (!bodies || bodies.length === 0) return false;

    const sortedBodies = bodies.slice().sort((a, b) =>
        _.sum(b, p => BODYPART_COST[p]) - _.sum(a, p => BODYPART_COST[p])
    );

    for (const body of sortedBodies) {
        const cost = _.sum(body, p => BODYPART_COST[p]);
        if (spawn.room.energyAvailable >= cost) {
            const name = role + Game.time + Math.floor(Math.random() * 1000);
            if (spawn.spawnCreep(body, name, { memory }) === OK) {
                console.log(`⚡ Spawning ${role}: ${name} (cost: ${cost})`);
                return true;
            }
        }
    }
    return false;
}

// === Helper: report creeps and CPU usage ===
global.reportCreeps = function() {
    const roles = ['harvester','upgrader','builder','repairer','soldier','healer','huller','runner','scout'];
    let report = '';
    for (const role of roles) {
        const count = _.filter(Game.creeps, c => c.memory.role === role).length;
        if (count > 0) {
            const color = role === 'harvester' ? '#ffff00' :
                          role === 'upgrader'  ? '#00ff00' :
                          role === 'builder'   ? '#00ffff' :
                          role === 'repairer'  ? '#ff00ff' :
                          role === 'soldier'   ? '#ff0000' :
                          role === 'healer'    ? '#ffffff' :
                          role === 'huller'    ? '#ffa500' :
                          role === 'runner'    ? '#00aaff' :
                          '#ccc';
            report += `<span style="color:${color}">${role}:${count}</span> `;
        }
    }
    console.log(report);
};


function setupSourceContainers(room) {
    if (!room.memory.sourceContainers || Game.time % 50 === 0) {
        const containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER &&
                          (!room.controller || !s.pos.inRangeTo(room.controller, 4))
        });
        room.memory.sourceContainers = containers.map(c => c.id);
    }
}

// === Main loop ===
module.exports.loop = function () {
    const loopStart = Game.cpu.getUsed();

    // --- Clean dead creeps memory ---
    for (let name in Memory.creeps) if (!Game.creeps[name]) delete Memory.creeps[name];

    const spawn = Game.spawns['Main1'];
    if (!spawn) return;
    const room = spawn.room;
    const homeRoom = room.name;

    setupSourceContainers(room);

    // --- Cache room finds ---
    if (!room.memory._cache || Game.time % 10 === 0) {
        room.memory._cache = {
            sources: room.find(FIND_SOURCES),
            constructionSites: room.find(FIND_CONSTRUCTION_SITES),
            damagedStructures: room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART }),
            hostiles: room.find(FIND_HOSTILE_CREEPS),
            injuredCreeps: room.find(FIND_MY_CREEPS, { filter: c => c.hits < c.hitsMax })
        };
    }

    const { sources, constructionSites, damagedStructures, hostiles, injuredCreeps } = room.memory._cache;

    // --- Remote rooms cache ---
    for (const rName of remoteRooms) {
        if (!Memory.rooms) Memory.rooms = {};
        if (!Memory.rooms[rName] || Game.time % 50 === 0) {
            const r = Game.rooms[rName];
            Memory.rooms[rName] = r ? {
                sources: r.find(FIND_SOURCES).map(s => s.id),
                controller: r.controller ? r.controller.id : null
            } : { sources: [], controller: null };
        }
    }

    // --- Count creeps by role ---
    const counts = {};
    for (const role of ['harvester','builder','upgrader','repairer','soldier','healer','huller','runner']) {
        counts[role] = _.filter(Game.creeps, c => c.memory.role === role);
    }

    // --- Define bodies ---
    const bodies = {
        harvester: [[WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,MOVE],[WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,MOVE],[WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE],[WORK,WORK,CARRY,MOVE,MOVE],[WORK,CARRY,MOVE]],
        upgrader:  [[WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,MOVE],[WORK,WORK,WORK,WORK,WORK,CARRY,MOVE],[WORK,CARRY,MOVE]],
        builder:   [[WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE],[WORK,WORK,CARRY,MOVE,MOVE],[WORK,CARRY,MOVE]],
        repairer:  [[WORK,WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE],[WORK,WORK,CARRY,MOVE,MOVE],[WORK,CARRY,MOVE]],
        soldier:   [[TOUGH,TOUGH,ATTACK,ATTACK,ATTACK,ATTACK,MOVE,MOVE,MOVE,MOVE],[TOUGH,TOUGH,ATTACK,ATTACK,MOVE,MOVE,MOVE],[TOUGH,ATTACK,MOVE,MOVE]],
        healer:    [[HEAL,HEAL,HEAL,MOVE,MOVE]],
        huller:    [[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE],[CARRY,CARRY,CARRY,CARRY,MOVE,MOVE],[CARRY,CARRY,MOVE]],
        runner:    [[CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE],[CARRY,CARRY,CARRY,CARRY,MOVE,MOVE],[CARRY,CARRY,MOVE]]
    };

    // --- Max counts ---
    const maxCounts = {
        harvester: sources.length * 3,
        builder: constructionSites.length > 0 ? Math.min(3, Math.ceil(constructionSites.length / 2)) : 0,
        repairer: damagedStructures.length > 0 ? Math.min(3, Math.ceil(damagedStructures.length / 5)) : 0,
        soldier: hostiles.length > 0 ? Math.min(5, Math.ceil(hostiles.length / 2)) : 0,
        healer: 0,
        huller: sources.length * 2,
        runner: 2
    };

    // --- HARVESTERS FIRST (home → remote) ---
    if (!spawn.spawning) {
        let spawned = false;

        function spawnHarvestersForRoom(rName, isHome) {
            const rMem = isHome ? room.memory : Memory.rooms[rName];
            if (!rMem || !rMem.sources) return;
        
            // --- Skip spawning harvesters if remote room has full link setup ---
            if (!isHome) {
                const r = Game.rooms[rName];
                if (r && r.memory && r.memory.links) {
                    const hasSourceLinks = (r.memory.links.sourceLinkIds || []).length > 0;
                    const hasControllerLink = !!r.memory.links.controllerLinkId;
                    if (hasSourceLinks && hasControllerLink) {
                        // No harvesters needed, links will handle energy transfer
                        return;
                    }
                }
            }
        
            // --- Otherwise spawn harvesters as usual ---
            rMem.sources.forEach((sourceId, i) => {
                const assigned = _.filter(Game.creeps, c =>
                    c.memory.role === 'harvester' &&
                    (isHome ? c.memory.homeRoom : c.memory.targetRoom) === rName &&
                    c.memory.sourceIndex === i
                );
        
                const spawningAssigned = spawn.spawning && spawn.spawning.name ? [Game.creeps[spawn.spawning.name]].filter(c =>
                    c.memory.role === 'harvester' &&
                    (isHome ? c.memory.homeRoom : c.memory.targetRoom) === rName &&
                    c.memory.sourceIndex === i
                ) : [];
        
                const needed = 3 - (assigned.length + spawningAssigned.length);
                for (let j = 0; j < needed && !spawned; j++) {
                    spawned = spawnLargestCreep(spawn, 'harvester', bodies.harvester, {
                        role: 'harvester',
                        homeRoom,
                        targetRoom: rName,
                        sourceIndex: i
                    }) || spawned;
                }
            });
        }


        spawnHarvestersForRoom(homeRoom, true);
        remoteRooms.forEach(rName => spawnHarvestersForRoom(rName, false));

        if (spawned) return; // only spawn harvesters this tick
    }

    // --- SPAWN OTHER ROLES ---
    if (!spawn.spawning) {
        for (const roomName in Game.rooms) {
            const r = Game.rooms[roomName];
            if (!r.controller || !r.controller.my) continue;

            // --- Upgraders ---
            const upgraders = _.filter(Game.creeps, c => c.memory.role === 'upgrader' && c.memory.targetRoom === roomName);
            const targetWork = r.controller.level < 8 ? 30 : 15;
            const totalWork = _.sum(upgraders, c => c.getActiveBodyparts(WORK));
            const missingWork = Math.max(0, targetWork - totalWork);
            if (missingWork > 0 && upgraders.length < 6) {
                const mem = { role: 'upgrader', homeRoom, targetRoom: roomName };
                if (upgraders.length === 0) spawnLargestCreep(spawn, 'upgrader', [[WORK,CARRY,MOVE]], mem);
                else {
                    let workToUse = Math.min(10, missingWork);
                    let spawnedUp = false;
                    while(workToUse>0 && !spawnedUp){
                        const body = Array(workToUse).fill(WORK).concat([CARRY,MOVE]);
                        if(spawnLargestCreep(spawn,'upgrader',[body],mem)) spawnedUp = true;
                        else workToUse--;
                    }
                }
            }

            // --- Builders ---
            const sites = r.find(FIND_CONSTRUCTION_SITES);
            if(sites.length>0){
                const assignedBuilders = _.filter(Game.creeps, c => c.memory.role==='builder' && c.memory.targetRoom===roomName);
                const maxB = Math.min(6, Math.ceil(sites.length/2));
                if(assignedBuilders.length<maxB) spawnLargestCreep(spawn,'builder',bodies.builder,{role:'builder',homeRoom,targetRoom:roomName});
            }

            // --- Repairers ---
            const repairers = _.filter(Game.creeps, c => c.memory.role==='repairer' && c.memory.targetRoom===roomName);
            const maxR = roomName===homeRoom ? 4 : 2;
            if(repairers.length<maxR) spawnLargestCreep(spawn,'repairer',[[WORK,CARRY,MOVE,MOVE],[WORK,WORK,CARRY,MOVE,MOVE],[WORK,WORK,WORK,CARRY,MOVE,MOVE]],{role:'repairer',homeRoom,targetRoom:roomName});

            // --- Runners ---
            const controllerLink = r.memory.links ? Game.getObjectById(r.memory.links.controllerLinkId) : null;
            const runnerTarget = controllerLink ? 2 : 3;
            const assignedRunners = _.filter(Game.creeps, c => c.memory.role==='runner' && c.memory.targetRoom===roomName);
            if(assignedRunners.length<runnerTarget) spawnLargestCreep(spawn,'runner',bodies.runner,{role:'runner',homeRoom,targetRoom:roomName});
        }

        // --- Hullers ---
        if(counts['huller'].length<maxCounts['huller']) spawnLargestCreep(spawn,'huller',bodies.huller,{role:'huller',homeRoom});

        // --- Other roles ---
        for(const role of ['soldier','healer']){
            if(counts[role].length<maxCounts[role]) spawnLargestCreep(spawn,role,bodies[role],{role,homeRoom});
        }
    }

    // --- Execute creep roles ---
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

    //LINK MANAGER
    LinkManager.run("E57N42");
    
    // --- Towers ---
    const towers = room.find(FIND_MY_STRUCTURES,{filter:{structureType:STRUCTURE_TOWER}});
    for(const tower of towers){
        const hostile = tower.pos.findClosestByRange(hostiles);
        if(hostile){ tower.attack(hostile); continue; }
        const injured = tower.pos.findClosestByRange(injuredCreeps);
        if(injured){ tower.heal(injured); continue; }
        const damaged = tower.pos.findClosestByRange(damagedStructures);
        if(damaged) tower.repair(damaged);
    }

    // --- Pixel generation ---
    if(Game.cpu.generatePixel && Game.cpu.bucket>=10000){ Game.cpu.generatePixel(); }
};
