// ===== Room-level helpers =====
function getRoomEnergySource(room) {
    const mem = Memory.rooms[room.name] || (Memory.rooms[room.name] = {});

    if (mem.energySourceId) {
        const obj = Game.getObjectById(mem.energySourceId);
        if (obj && obj.store && obj.store[RESOURCE_ENERGY] > 0) return obj;
        delete mem.energySourceId;
    }

    // Search only if not cached
    const source = room.find(FIND_STRUCTURES, {
        filter: s =>
            (s.structureType === STRUCTURE_STORAGE ||
             s.structureType === STRUCTURE_CONTAINER) &&
            s.store[RESOURCE_ENERGY] > 0
    })[0];

    if (source) mem.energySourceId = source.id;
    return source;
}

function getRoomBuildTarget(room) {
    const mem = Memory.rooms[room.name] || (Memory.rooms[room.name] = {});

    if (mem.buildTargetId) {
        const obj = Game.getObjectById(mem.buildTargetId);
        if (obj && obj.progress < obj.progressTotal) return obj;
        delete mem.buildTargetId;
    }

    const sites = room.find(FIND_CONSTRUCTION_SITES);
    if (sites.length === 0) return null;

    const priorityMap = {
        [STRUCTURE_SPAWN]: 1,
        [STRUCTURE_LINK]: 2,
        [STRUCTURE_CONTAINER]: 3,
        [STRUCTURE_EXTENSION]: 4,
        [STRUCTURE_TOWER]: 5,
        [STRUCTURE_STORAGE]: 6,
        [STRUCTURE_ROAD]: 10,
        [STRUCTURE_WALL]: 11,
        [STRUCTURE_RAMPART]: 12
    };

    sites.sort((a, b) => {
        const prioA = priorityMap[a.structureType] || 99;
        const prioB = priorityMap[b.structureType] || 99;
        if (prioA !== prioB) return prioA - prioB;
        return a.progress - b.progress; // less complete first
    });

    const target = sites[0];
    if (target) mem.buildTargetId = target.id;
    return target;
}

// ===== Role: Builder =====
const roleBuilder = {
    run: function(creep) {
        const homeRoom   = creep.memory.homeRoom;
        const targetRoom = creep.memory.targetRoom || homeRoom;

        // === Move to assigned room first ===
        if (creep.room.name !== targetRoom) {
            creep.moveTo(new RoomPosition(25, 25, targetRoom), {
                visualizePathStyle: { stroke: '#ffffff' }
            });
            creep.memory.action = `Moving to ${targetRoom}`;
            return;
        }

        // === State toggle ===
        if (creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.building = false;
        }
        if (!creep.memory.building && creep.store.getFreeCapacity() === 0) {
            creep.memory.building = true;
        }

        if (creep.memory.building) {
            // --- BUILDING ---
            let target = getRoomBuildTarget(creep.room);

            if (target) {
                if (creep.build(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                }
                creep.memory.action = `Building ${target.structureType}`;
            } else {
                // Fallback: upgrade controller
                if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
                }
                creep.memory.action = "Upgrading controller (no build sites)";
            }

        } else {
            // --- GATHERING ---
            const dropped = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 3, {
                filter: r => r.resourceType === RESOURCE_ENERGY
            })[0];

            if (dropped) {
                if (creep.pickup(dropped) === ERR_NOT_IN_RANGE) creep.moveTo(dropped);
                creep.memory.action = "Picking up dropped energy";
            } else {
                const source = getRoomEnergySource(creep.room) ||
                               creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);

                if (source) {
                    if (source.store) {
                        if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(source);
                        creep.memory.action = "Withdrawing from storage/container";
                    } else {
                        if (creep.harvest(source) === ERR_NOT_IN_RANGE) creep.moveTo(source);
                        creep.memory.action = "Harvesting energy";
                    }
                } else {
                    creep.memory.action = "Idle - no energy sources";
                    creep.moveTo(creep.room.storage || creep.room.controller);
                }
            }
        }
    }
};

module.exports = roleBuilder;

module.exports = roleBuilder;
