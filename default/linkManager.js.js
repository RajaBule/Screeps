// === Link Manager ===
// Classic logic per owned room:
// - If storage link exists: sources → storage, storage → controller
// - If no storage link: sources → controller directly

module.exports = {
    setupLinks(room) {
        if (!room.memory.links) room.memory.links = {};

        const links = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK
        });

        // Reset
        room.memory.links.sourceLinkIds = [];

        for (const link of links) {
            if (room.storage && link.pos.inRangeTo(room.storage, 3)) {
                room.memory.links.storageLinkId = link.id;
            } else if (room.controller && link.pos.inRangeTo(room.controller, 3)) {
                room.memory.links.controllerLinkId = link.id;
            } else {
                room.memory.links.sourceLinkIds.push(link.id);
            }
        }
    },

    runAll() {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            this.setupLinks(room);

            const storageLink = Game.getObjectById(room.memory.links.storageLinkId);
            const controllerLink = Game.getObjectById(room.memory.links.controllerLinkId);

            // === 1. Handle source links ===
            for (const id of (room.memory.links.sourceLinkIds || [])) {
                const sourceLink = Game.getObjectById(id);
                if (!sourceLink || sourceLink.cooldown > 0) continue;

                if (sourceLink.store[RESOURCE_ENERGY] >= 200) {
                    if (storageLink && storageLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        sourceLink.transferEnergy(storageLink);
                        room.memory.lastLinkAction =
                            `📡 Source → Storage in ${roomName} at tick ${Game.time}`;
                    } else if (
                        !storageLink &&
                        controllerLink &&
                        controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    ) {
                        sourceLink.transferEnergy(controllerLink);
                        room.memory.lastLinkAction =
                            `⚡ Source → Controller in ${roomName} at tick ${Game.time}`;
                    }
                }
            }

            // === 2. Storage link feeds controller ===
            if (
                storageLink &&
                controllerLink &&
                storageLink.cooldown === 0 &&
                storageLink.store[RESOURCE_ENERGY] >= 200 &&
                controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            ) {
                storageLink.transferEnergy(controllerLink);
                room.memory.lastLinkAction =
                    `⚡ Storage → Controller in ${roomName} at tick ${Game.time}`;
            }
        }
    }
};
