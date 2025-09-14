// === Link Manager ===
// Handles harvester links → controller link → storage link
// And storage link → controller links (all rooms)

module.exports = {
    setupLinks(room) {
        if (!room.memory.links) room.memory.links = {};

        const links = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK
        });

        // Reset arrays to avoid duplicates
        room.memory.links.sourceLinkIds = [];

        for (const link of links) {
            if (room.storage && link.pos.inRangeTo(room.storage, 3)) {
                room.memory.links.storageLinkId = link.id; // main storage link
            } else if (room.controller && link.pos.inRangeTo(room.controller, 3)) {
                room.memory.links.controllerLinkId = link.id; // controller upgrader link
            } else {
                room.memory.links.sourceLinkIds.push(link.id); // harvest/source links
            }
        }
    },

    run(mainRoomName) {
        const mainRoom = Game.rooms[mainRoomName];
        if (!mainRoom) return;

        this.setupLinks(mainRoom);

        const storageLink = Game.getObjectById(mainRoom.memory.links.storageLinkId);
        if (!storageLink) return;

        // === 1. Handle each room’s source links ===
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            this.setupLinks(room);

            const controllerLink = Game.getObjectById(room.memory.links.controllerLinkId);

            for (const id of (room.memory.links.sourceLinkIds || [])) {
                const sourceLink = Game.getObjectById(id);
                if (!sourceLink || sourceLink.cooldown > 0) continue;

                if (sourceLink.store[RESOURCE_ENERGY] >= 200) {
                    // Priority: send to local controller link
                    if (
                        controllerLink &&
                        controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    ) {
                        sourceLink.transferEnergy(controllerLink);
                        room.memory.lastLinkAction =
                            `⚡ Source → Controller in ${roomName} at tick ${Game.time}`;
                    }
                    // Otherwise send to storage link
                    else if (storageLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        sourceLink.transferEnergy(storageLink);
                        room.memory.lastLinkAction =
                            `📡 Source in ${roomName} → Storage(${mainRoomName}) at tick ${Game.time}`;
                    }
                }
            }
        }

        // === 2. Storage link distributes energy to controller links ===
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            const controllerLink = Game.getObjectById(room.memory.links.controllerLinkId);
            if (!controllerLink) continue;

            if (
                storageLink.cooldown === 0 &&
                storageLink.store[RESOURCE_ENERGY] >= 200 &&
                controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            ) {
                storageLink.transferEnergy(controllerLink);
                room.memory.lastLinkAction =
                    `⚡ Fed controller in ${roomName} from Storage(${mainRoomName}) at tick ${Game.time}`;
            }
        }
    }
};
