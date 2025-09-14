const roleHarvester = {
    run: function (creep, spawn) {
        const homeRoom   = creep.memory.homeRoom;
        const targetRoom = creep.memory.targetRoom || homeRoom;

        // === Move to target room if not there yet ===
        if (creep.room.name !== targetRoom) {
            const exitDir = creep.room.findExitTo(targetRoom);
            if (exitDir !== ERR_NO_PATH) {
                const exit = creep.pos.findClosestByPath(exitDir);
                if (exit) {
                    // 👇 Force creep to move fully across room border
                    creep.moveTo(exit, { 
                        visualizePathStyle: { stroke: '#ffaa00' },
                        reusePath: 10
                    });

                    // If stuck on room edge, nudge inside
                    if (creep.pos.x === 0) creep.move(RIGHT);
                    else if (creep.pos.x === 49) creep.move(LEFT);
                    else if (creep.pos.y === 0) creep.move(BOTTOM);
                    else if (creep.pos.y === 49) creep.move(TOP);

                    creep.memory.action = `Moving to ${targetRoom}`;
                    creep.memory.nextAction = "Harvest in target room";
                    return;
                }
            }
            creep.memory.action = `Waiting for visibility to ${targetRoom}`;
            creep.memory.nextAction = "Harvest once arrived";
            return;
        }

        // === If creep can still carry → harvest ===
        if (creep.store.getFreeCapacity() > 0) {
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (source) {
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
                creep.memory.action = "Harvesting energy";
                creep.memory.nextAction = "Deposit or drop when full";
            }
            return;
        }

        // === Full: find a structure within 3 tiles of the source ===
        const source = creep.pos.findClosestByPath(FIND_SOURCES);
        let nearbyLink = null;
        let nearbyContainer = null;

        if (source) {
            nearbyLink = source.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: s => s.structureType === STRUCTURE_LINK &&
                             s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            })[0];

            nearbyContainer = source.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: s => s.structureType === STRUCTURE_CONTAINER &&
                             s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            })[0];
        }

        // === Case 1: Prefer link if in range ===
        if (nearbyLink && creep.pos.getRangeTo(nearbyLink) <= 3) {
            if (creep.transfer(nearbyLink, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(nearbyLink, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            creep.memory.action = "Depositing into link";
            creep.memory.nextAction = "Harvest again";
            return;
        }

        // === Case 2: Container nearby ===
        if (nearbyContainer && creep.pos.getRangeTo(nearbyContainer) <= 3) {
            if (creep.transfer(nearbyContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(nearbyContainer, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            creep.memory.action = "Depositing into container";
            creep.memory.nextAction = "Harvest again";
            return;
        }

        // === Case 3: Early game / bootstrap → feed spawn ===
        if (spawn && spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.transfer(spawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            creep.memory.action = "Delivering to spawn (bootstrap)";
            creep.memory.nextAction = "Harvest again";
            return;
        }

        // === Case 4: Nothing else → drop at source ===
        creep.drop(RESOURCE_ENERGY);
        creep.memory.action = "Dropping energy at source";
        creep.memory.nextAction = "Harvest again";
    }
};

module.exports = roleHarvester;
