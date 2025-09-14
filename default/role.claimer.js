const roleClaimer = {
    run: function(creep) {
        const controller = creep.room.controller;
        if (!controller) return;

        if (controller.owner && controller.owner.username !== MY_USERNAME) {
            creep.memory.action = "Controller owned by someone else!";
            return;
        }

        if (controller.level === 0) {
            // Neutral controller: claim it
            if (creep.claimController(controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(controller, { visualizePathStyle: { stroke: '#00ff00' } });
            } else {
                creep.memory.action = "Claiming neutral controller";
            }
        } else {
            // Already claimed by you: reserve to maintain control
            if (creep.reserveController(controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(controller, { visualizePathStyle: { stroke: '#00ff00' } });
            } else {
                creep.memory.action = "Reserving controller";
            }
        }
    }
};
