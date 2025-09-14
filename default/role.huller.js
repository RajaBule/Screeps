// role.huller.js
// HULLER: withdraw from harvest containers (no controller container)
// OR from STORAGE if harvest links exist in the room.
// Deliver in order: Spawn → Extensions → Towers → Storage (only if no links).

function ensureSourceContainers(room) {
    if (!room.memory) room.memory = {};
    // refresh periodically (in case containers are built/destroyed)
    if (!room.memory.sourceContainers || Game.time % 50 === 0) {
        const containers = room.find(FIND_STRUCTURES, {
            filter: s =>
                s.structureType === STRUCTURE_CONTAINER &&
                // exclude controller container
                (!room.controller || !s.pos.inRangeTo(room.controller, 4))
        });
        room.memory.sourceContainers = containers.map(c => c.id);
    }
}

function ensureHarvestLinks(room) {
    if (!room.memory) room.memory = {};
    if (!room.memory.harvestLinks || Game.time % 50 === 0) {
        const links = [];
        const sources = room.find(FIND_SOURCES);
        for (const src of sources) {
            const nearby = src.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: s => s.structureType === STRUCTURE_LINK
            });
            if (nearby.length > 0) {
                links.push(nearby[0].id); // assume one per source
            }
        }
        room.memory.harvestLinks = links;
    }
}

function assignContainerToHuller(creep) {
    const room = creep.room;
    ensureSourceContainers(room);
    const containers = room.memory.sourceContainers || [];
    if (containers.length === 0) return;

    // count existing assignments
    const counts = {};
    for (let id of containers) counts[id] = 0;
    for (let n in Game.creeps) {
        const c = Game.creeps[n];
        if (!c || !c.memory) continue;
        if (c.memory.role === 'huller' && c.memory.assignedContainerId && counts[c.memory.assignedContainerId] !== undefined) {
            counts[c.memory.assignedContainerId]++;
        }
    }

    // pick the container with the fewest assigned hullers
    let best = containers[0];
    let min = counts[best] || 0;
    for (let id of containers) {
        if (counts[id] < min) {
            best = id;
            min = counts[id];
        }
    }

    creep.memory.assignedContainerId = best;
}

const roleHuller = {
    run: function(creep) {
        const room = Game.rooms[creep.memory.homeRoom || creep.room.name];
        if (!room) return;

        // === Refresh memory of links ===
        ensureHarvestLinks(room);

        // === Check if we are in "link mode" (harvest links exist) ===
        const linkMode = (room.memory.harvestLinks || []).length > 0;

        // assign container if needed (only if not in link mode)
        if (!linkMode && !creep.memory.assignedContainerId) {
            assignContainerToHuller(creep);
        }

        // state flip
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
        }

        // === WORKING: Deliver ===
        if (creep.memory.working) {
            let target = null;

            // 1) Spawn
            target = creep.pos.findClosestByPath(FIND_MY_SPAWNS, {
                filter: s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });

            // 2) Extensions
            if (!target) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_EXTENSION &&
                                 s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
            }

            // 3) Towers
            if (!target) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_TOWER &&
                                 s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
            }

            // 4) Storage (only if NOT in link mode)
            if (!target && !linkMode) {
                if (room.storage && room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    target = room.storage;
                }
            }

            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                }
                creep.memory.action = `Delivering to ${target.structureType || 'spawn'}`;
                creep.memory.nextAction = "Return to energy source";
            } else {
                creep.memory.action = "No delivery targets";
                const spawns = creep.room.find(FIND_MY_SPAWNS);
                if (spawns.length > 0) creep.moveTo(spawns[0], { range: 2 });
            }
            return;
        }

        // === HARVEST PHASE ===
        // === HARVEST PHASE ===
        if (linkMode) {
            // Link mode: always withdraw from storage
            if (room.storage && room.storage.store[RESOURCE_ENERGY] > 0) {
                if (creep.withdraw(room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(room.storage, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
                creep.memory.action = "Withdrawing from storage (link mode)";
                creep.memory.nextAction = "Deliver to targets";
                return;
            }
        } else {
            // Normal mode: containers first
            const assignedId = creep.memory.assignedContainerId;
            let assignedContainer = assignedId ? Game.getObjectById(assignedId) : null;
        
            if (!assignedContainer || assignedContainer.store[RESOURCE_ENERGY] === 0) {
                assignContainerToHuller(creep);
                if (creep.memory.assignedContainerId)
                    assignedContainer = Game.getObjectById(creep.memory.assignedContainerId);
            }
        
            if (assignedContainer && assignedContainer.store[RESOURCE_ENERGY] > 0) {
                if (creep.withdraw(assignedContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(assignedContainer, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
                creep.memory.action = "Withdrawing from container";
                creep.memory.nextAction = "Deliver to targets";
                return;
            }
        
            // fallback: pick up dropped energy
            const dropped = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
            });
            if (dropped) {
                if (creep.pickup(dropped) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(dropped, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
                creep.memory.action = "Picking up dropped energy";
                creep.memory.nextAction = "Deliver to targets";
                return;
            }
        
            // FINAL fallback: storage if available
            if (room.storage && room.storage.store[RESOURCE_ENERGY] > 0) {
                if (creep.withdraw(room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(room.storage, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
                creep.memory.action = "Withdrawing from storage (backup)";
                creep.memory.nextAction = "Deliver to targets";
                return;
            }
        }
        
        // idle near spawn if nothing else
        creep.memory.action = "No energy available";
        const spawns = creep.room.find(FIND_MY_SPAWNS);
        if (spawns.length > 0) creep.moveTo(spawns[0], { range: 2 });
        
    }
};

module.exports = roleHuller;
