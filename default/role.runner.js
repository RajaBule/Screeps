const roleRunner = {
    run: function(creep) {
        const homeRoom   = creep.memory.homeRoom || creep.room.name;
        const targetRoom = creep.memory.targetRoom || homeRoom;
        const room       = creep.room;
        const controller = room.controller;

        // === Move to assigned room ===
        if (room.name !== targetRoom) {
            if (!creep.memory.exit || Game.time % 20 === 0) {
                const exitDir = Game.map.findExit(room, targetRoom);
                if (exitDir < 0) return;
                const exit = creep.pos.findClosestByPath(exitDir);
                creep.memory.exit = exit ? { x: exit.x, y: exit.y } : null;
            }
            if (creep.memory.exit) {
                const pos = new RoomPosition(creep.memory.exit.x, creep.memory.exit.y, room.name);
                if (creep.pos.isEqualTo(pos)) delete creep.memory.exit;
                else creep.moveTo(pos, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }

        // === Collect energy ===
        if (creep.store[RESOURCE_ENERGY] === 0) {
            let source = Game.getObjectById(creep.memory.gatherTargetId);

            // validate cached target
            if (source && source.store && source.store[RESOURCE_ENERGY] === 0) source = null;
            if (source && source.resourceType && source.amount === 0) source = null;

            if (!source) {
                source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: s =>
                        s.structureType === STRUCTURE_CONTAINER &&
                        s.store[RESOURCE_ENERGY] > 0 &&
                        (!controller || !s.pos.inRangeTo(controller.pos, 3)) // avoid controller container
                }) || creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                    filter: r => r.resourceType === RESOURCE_ENERGY
                });

                creep.memory.gatherTargetId = source ? source.id : null;
            }

            if (source) {
                if (source.store) {
                    if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) creep.moveTo(source);
                } else if (source.resourceType) {
                    if (creep.pickup(source) === ERR_NOT_IN_RANGE) creep.moveTo(source);
                }
            }
            return;
        }

        // === Deliver energy ===
        let target = Game.getObjectById(creep.memory.deliverTargetId);

        // validate cached target
        if (target && target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) target = null;

        if (!target || creep.memory.deliverTargetId === "drop") {
            target = null;

            const storageLink = room.memory.links ? Game.getObjectById(room.memory.links.storageLinkId) : null;

            // 1. Controller container
            if (controller) {
                const ctrlContainer = controller.pos.findInRange(FIND_STRUCTURES, 3, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER &&
                                 s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                })[0];
                if (ctrlContainer) target = ctrlContainer;
            }

            // 2. Storage Link
            if (!target && storageLink && storageLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                target = storageLink;
            }

            // 3. Towers
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
                    filter: s =>
                        s.structureType === STRUCTURE_TOWER &&
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
            }

            // 4. Spawns & Extensions
            if (!target) {
                target = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
                    filter: s =>
                        (s.structureType === STRUCTURE_SPAWN ||
                         s.structureType === STRUCTURE_EXTENSION) &&
                        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
            }

            // 5. Storage
            if (!target) {
                target = room.storage && room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    ? room.storage
                    : null;
            }

            // === Fallback: drop near controller ===
            if (!target && controller) {
                creep.memory.deliverTargetId = "drop";
                if (!room.memory.dropPos) {
                    const terrain = room.getTerrain();
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            if (dx === 0 && dy === 0) continue;
                            const x = controller.pos.x + dx, y = controller.pos.y + dy;
                            if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                                room.memory.dropPos = { x, y };
                                break;
                            }
                        }
                        if (room.memory.dropPos) break;
                    }
                }
            }

            creep.memory.deliverTargetId = target ? target.id : creep.memory.deliverTargetId;
        }

        // === Act on target ===
        if (creep.memory.deliverTargetId === "drop") {
            const dropPos = room.memory.dropPos;
            if (dropPos) {
                const pos = new RoomPosition(dropPos.x, dropPos.y, targetRoom);
                if (creep.pos.isEqualTo(pos)) creep.drop(RESOURCE_ENERGY);
                else creep.moveTo(pos, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        } else if (target) {
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    }
};

module.exports = roleRunner;
