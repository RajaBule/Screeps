// role.repairer.js

// Priority function using % health
function repairPriority(s) {
    const ratio = s.hits / s.hitsMax; // health %
    switch (s.structureType) {
        case STRUCTURE_CONTAINER: return 0 + ratio;
        case STRUCTURE_TOWER: return 1 + ratio;
        case STRUCTURE_ROAD: return 2 + ratio;
        case STRUCTURE_RAMPART: return 3 + ratio;
        case STRUCTURE_SPAWN: return 4 + ratio;
        case STRUCTURE_EXTENSION: return 5 + ratio;
        case STRUCTURE_STORAGE: return 6 + ratio;
        case STRUCTURE_LINK: return 7 + ratio;
        case STRUCTURE_LAB: return 8 + ratio;
        case STRUCTURE_OBSERVER: return 9 + ratio;
        case STRUCTURE_TERMINAL: return 10 + ratio;
        case STRUCTURE_WALL: return 11 + ratio;
        default: return 12 + ratio;
    }
}

const roleRepairer = {
    run: function (creep) {
        const homeRoom   = creep.memory.homeRoom || creep.room.name;
        const targetRoom = creep.memory.targetRoom || homeRoom;

        // === Move to assigned room ===
        if (creep.room.name !== targetRoom) {
            if (!creep.memory.exit || Game.time % 20 === 0) {
                const exitDir = Game.map.findExit(creep.room, targetRoom);
                if (exitDir < 0) return; // no route
                const exit = creep.pos.findClosestByPath(exitDir);
                creep.memory.exit = exit ? { x: exit.x, y: exit.y } : null;
            }

            if (creep.memory.exit) {
                const pos = new RoomPosition(creep.memory.exit.x, creep.memory.exit.y, creep.room.name);
                if (creep.pos.isEqualTo(pos)) {
                    delete creep.memory.exit; // clear cache at edge
                } else {
                    creep.moveTo(pos, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            }
            return;
        }

        // --- Switch state based on energy ---
        if (creep.memory.repairing && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.repairing = false;
            creep.say('🔄 harvest');
        }
        if (!creep.memory.repairing && creep.store.getFreeCapacity() === 0) {
            creep.memory.repairing = true;
            creep.say('🛠️ repair');
        }

        // === REPAIRING MODE ===
        if (creep.memory.repairing) {
            let target = Game.getObjectById(creep.memory.repairTargetId);

            if (!target) delete creep.memory.repairTargetId;

            if (!creep.room.memory.damagedStructures || Game.time % 20 === 0) {
                creep.room.memory.damagedStructures = creep.room.find(FIND_STRUCTURES, {
                    filter: s => s.hits < s.hitsMax
                }).map(s => s.id);
            }

            if (!target || !target.hits || target.hits === target.hitsMax) {
                target = null;
                const damaged = creep.room.memory.damagedStructures
                    .map(id => Game.getObjectById(id))
                    .filter(s => s && s.hits < s.hitsMax);

                if (damaged.length > 0) {
                    // Prefer non-wall targets first
                    let nonWalls = damaged.filter(s => s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART);
                    if (nonWalls.length > 0) {
                        target = _.min(nonWalls, repairPriority);
                    } else {
                        target = _.min(damaged, repairPriority); // fallback: walls/ramparts
                    }
                    creep.memory.repairTargetId = target.id;
                }
            }

            if (target) {
                if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            } else {
                const controller = creep.room.controller;
                if (controller && creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }

        // === HARVESTING MODE ===
        } else {
            let container = Game.getObjectById(creep.memory.energyTargetId);

            if (!container || !container.store) {
                delete creep.memory.energyTargetId;
                container = null;
            }

            if (!container || container.store[RESOURCE_ENERGY] === 0) {
                const containers = creep.room.find(FIND_STRUCTURES, {
                    filter: s =>
                        (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                        s.store[RESOURCE_ENERGY] > 0
                });
                if (containers.length > 0) {
                    container = creep.pos.findClosestByPath(containers);
                    if (container) {
                        creep.memory.energyTargetId = container.id;
                    }
                }
            }

            if (container) {
                if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(container, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            } else {
                const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            }
        }
    }
};

module.exports = roleRepairer;
