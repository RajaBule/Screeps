const roleLinkManager = {
    run: function(creep) {
        const room = Game.rooms[creep.memory.homeRoom];
        if (!room || !room.memory.links) return;

        const storageLink = Game.getObjectById(room.memory.links.storageLinkId);
        if (!storageLink || !room.storage) return;

        if (creep.store.getFreeCapacity() > 0) {
            if (storageLink.store[RESOURCE_ENERGY] > 0) {
                if (creep.withdraw(storageLink, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(storageLink);
                }
            }
        } else {
            if (creep.transfer(room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(room.storage);
            }
        }
    }
};
