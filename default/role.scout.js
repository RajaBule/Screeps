const roleScout = {
    run: function(creep) {
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) return;

        // Nudge off borders to avoid bouncing
        if (creep.pos.x === 0) return creep.move(RIGHT);
        if (creep.pos.x === 49) return creep.move(LEFT);
        if (creep.pos.y === 0) return creep.move(BOTTOM);
        if (creep.pos.y === 49) return creep.move(TOP);

        if (creep.room.name !== targetRoom) {
            const exitDir = Game.map.findExit(creep.room, targetRoom);
            if (exitDir >= 0) {
                const exit = creep.pos.findClosestByRange(exitDir);
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#00ffff' } });
                creep.memory.action = 'Heading to ' + targetRoom;
            }
            return;
        }

        // In target room → claim
        const controller = creep.room.controller;
        if (creep.getActiveBodyparts(CLAIM) > 0) {
            const result = creep.claimController(controller);
            if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(controller, { visualizePathStyle: { stroke: '#00ffff' } });
            }
        }
    }
};

module.exports = roleScout;
