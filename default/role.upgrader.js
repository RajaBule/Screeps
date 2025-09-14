const roleUpgrader = {
    run: function(creep) {
        const targetRoom = creep.memory.targetRoom || creep.room.name;
        const homeRoom = creep.memory.homeRoom || creep.room.name;

        // --- Handle targetRoom movement ---
        if (creep.room.name !== targetRoom) {
            const exitDir = creep.room.findExitTo(targetRoom);
            if (exitDir !== ERR_NO_PATH) {
                const exit = creep.pos.findClosestByPath(exitDir);
                if (exit) {
                    creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 5 });
                    creep.memory.action = `Moving to ${targetRoom}`;
                } else {
                    creep.memory.action = `Waiting to path to ${targetRoom}`;
                }
            } else {
                creep.memory.action = `No visible exit to ${targetRoom}`;
            }
            return; // Stop further logic until in targetRoom
        }

        const room = creep.room;
        const controller = room.controller;
        if (!controller) return;

        // --- Initialize memory ---
        if (!creep.memory.action) creep.memory.action = 'collecting';

        // --- Switch actions based on energy ---
        if (creep.store[RESOURCE_ENERGY] === 0) creep.memory.action = 'collecting';
        if (creep.store.getFreeCapacity() === 0) creep.memory.action = 'upgrading';

        // --- Collect energy ---
        if (creep.memory.action === 'collecting') {
            let target = null;

            // Try controller link first
            target = controller.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: s => s.structureType === STRUCTURE_LINK && s.store[RESOURCE_ENERGY] > 0
            })[0];

            // Then nearby containers
            if (!target) {
                target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                        s.store[RESOURCE_ENERGY] > 0
                });
            }

            // Fallback to dropped energy
            if (!target) {
                target = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                    filter: r => r.resourceType === RESOURCE_ENERGY
                });
            }

            if (target) {
                if (target.structureType) {
                    if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                } else if (target.resourceType) {
                    if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                }
            }
            return;
        }

        // --- Assign upgrade position ---
        if (!creep.memory.upgradePos) {
            const link = controller.pos.findInRange(FIND_STRUCTURES, 3, {
                filter: s => s.structureType === STRUCTURE_LINK
            })[0];

            const potentialPositions = [];
            for (let dx = -3; dx <= 3; dx++) {
                for (let dy = -3; dy <= 3; dy++) {
                    const x = controller.pos.x + dx;
                    const y = controller.pos.y + dy;

                    if (controller.pos.getRangeTo(x, y) > 3) continue;
                    if (room.getTerrain().get(x, y) & TERRAIN_MASK_WALL) continue;
                    if (link && link.pos.getRangeTo(x, y) > 1) continue;

                    potentialPositions.push({ x, y });
                }
            }

            const takenPositions = _.map(
                _.filter(Game.creeps, c =>
                    c.memory.role === 'upgrader' &&
                    c.memory.upgradePos &&
                    c.name !== creep.name
                ),
                c => `${c.memory.upgradePos.x},${c.memory.upgradePos.y}`
            );

            const freePositions = potentialPositions.filter(
                pos => !takenPositions.includes(`${pos.x},${pos.y}`)
            );

            if (freePositions.length > 0) {
                freePositions.sort((a, b) =>
                    controller.pos.getRangeTo(a.x, a.y) - controller.pos.getRangeTo(b.x, b.y)
                );
                creep.memory.upgradePos = freePositions[0];
            }
        }

        // --- Move to upgrade position ---
        const upgradePos = creep.memory.upgradePos ? 
            new RoomPosition(creep.memory.upgradePos.x, creep.memory.upgradePos.y, room.name) : null;
        if (upgradePos && !creep.pos.isEqualTo(upgradePos)) {
            creep.moveTo(upgradePos, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 5 });
            creep.memory.action = 'moving to upgrade pos';
            return;
        }

        // --- Upgrade controller ---
        if (creep.memory.action === 'upgrading') {
            if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(controller, { visualizePathStyle: { stroke: '#00ff00' }, reusePath: 5 });
            }
        }
    }
};

module.exports = roleUpgrader;
