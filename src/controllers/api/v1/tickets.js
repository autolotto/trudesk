/*
      .                             .o8                     oooo
   .o8                             "888                     `888
 .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
   888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
   888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
   888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
   "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 ========================================================================
 Created:    02/10/2015
 Author:     Chris Brame

 **/

var async = require('async'),
    _ = require('underscore'),
    _s = require('underscore.string'),
    winston = require('winston'),
    permissions = require('../../../permissions'),
    emitter = require('../../../emitter'),

    userSchema = require('../../../models/user');

var api_tickets = {};

/**
 * @api {get} /api/v1/tickets/ Get Tickets
 * @apiName getTickets
 * @apiDescription Gets tickets for the given User
 * @apiVersion 0.1.0
 * @apiGroup Ticket
 * @apiHeader {string} accesstoken The access token for the logged in user
 * @apiExample Example usage:
 * curl -H "accesstoken: {accesstoken}" -l http://localhost/api/v1/tickets
 *
 * @apiSuccess {object}     _id                 The MongoDB ID
 * @apiSuccess {number}     uid                 Unique ID (seq num)
 * @apiSuccess {object}     owner               User
 * @apiSuccess {object}     owner._id           The MongoDB ID of Owner
 * @apiSuccess {string}     owner.username      Username
 * @apiSuccess {string}     owner.fullname      User Full Name
 * @apiSuccess {string}     owner.email         User Email Address
 * @apiSuccess {string}     owner.role          User Permission Role
 * @apiSuccess {string}     owner.title         User Title
 * @apiSuccess {string}     owner.image         User Image Rel Path
 * @apiSuccess {object}     group               Group
 * @apiSuccess {object}     group._id           Group MongoDB ID
 * @apiSuccess {string}     group.name          Group Name
 * @apiSuccess {object}     assignee            User Assigned
 * @apiSuccess {object}     assignee._id        The MongoDB ID of Owner
 * @apiSuccess {string}     assignee.username   Username
 * @apiSuccess {string}     assignee.fullname   User Full Name
 * @apiSuccess {string}     assignee.email      User Email Address
 * @apiSuccess {string}     assignee.role       User Permission Role
 * @apiSuccess {string}     assignee.title      User Title
 * @apiSuccess {string}     assignee.image      User Image Rel Path
 * @apiSuccess {date}       date                Created Date
 * @apiSuccess {date}       updated             Last Updated DateTime
 * @apiSuccess {boolean}    deleted             Deleted Flag
 * @apiSuccess {object}     type                Ticket Type
 * @apiSuccess {object}     type._id            Type MongoDB ID
 * @apiSuccess {string}     type.name           Type Name
 * @apiSuccess {number}     status              Status of Ticket
 * @apiSuccess {number}     prioirty            Prioirty of Ticket
 * @apiSuccess {array}      tags                Array of Tags
 * @apiSuccess {string}     subject             Subject Text
 * @apiSuccess {string}     issue               Issue Text
 * @apiSuccess {date}       closedDate          Date Ticket was closed
 * @apiSuccess {array}      comments            Array of Comments
 * @apiSuccess {array}      attachments         Array of Attachments
 * @apiSuccess {array}      history             Array of History items
 *
 */
api_tickets.get = function(req, res) {
    var limit = req.query.limit;
    var page = req.query.page;
    var assignedSelf = req.query.assignedself;
    var status = req.query.status;
    var user = req.user;

    var object = {
        user: user,
        limit: limit,
        page: page,
        assignedSelf: assignedSelf,
        status: status
    };

    var ticketModel = require('../../../models/ticket');
    var groupModel = require('../../../models/group');

    async.waterfall([
        function(callback) {
            groupModel.getAllGroupsOfUser(user._id, function(err, grps) {
                callback(err, grps);
            })
        },
        function(grps, callback) {
            ticketModel.getTicketsWithObject(grps, object, function(err, results) {

                callback(err, results);
            });
        }
    ], function(err, results) {
        if (err) return res.send('Error: ' + err.message);

        return res.json(results);
    });
};

/**
 * @api {post} /api/v1/tickets/create Create Ticket
 * @apiName createTicket
 * @apiDescription Creates a ticket with the given post data.
 * @apiVersion 0.1.0
 * @apiGroup Ticket
 * @apiHeader {string} accesstoken The access token for the logged in user
 *
 * @apiParamExample {json} Request-Example:
 * {
 *      "subject": "Subject",
 * }
 *
 * @apiExample Example usage:
 * curl -H "accesstoken: {accesstoken}" -l http://localhost/api/v1/tickets
 *
 * @apiSuccess {boolean} success If the Request was a success
 * @apiSuccess {object} error Error, if occurred
 * @apiSuccess {object} ticket Saved Ticket Object
 *
 * @apiError InvalidPostData The data was invalid
 * @apiErrorExample
 *      HTTP/1.1 400 Bad Request
        {
            "error": "Invalid Post Data"
        }
 */

api_tickets.create = function(req, res) {
    var response = {};
    response.success = true;

    var postData = req.body;
    if (!_.isObject(postData)) return res.status(400).json({'success': false, error: 'Invalid Post Data'});

    var socketId = _.isUndefined(postData.socketId) ? '' : postData.socketId;
    var tags = [];
    if (!_.isUndefined(postData.tags)) {
        var t = _s.clean(postData.tags);
        tags = _.compact(t.split(','));
    }

    var HistoryItem = {
        action: 'ticket:created',
        description: 'Ticket was created.',
        owner: req.user._id
    };

    var ticketModel = require('../../../models/ticket');
    var ticket = new ticketModel(postData);
    ticket.owner = req.user._id;
    var marked = require('marked');
    var tIssue = ticket.issue;
    tIssue = tIssue.replace(/(\r\n|\n\r|\r|\n)/g, "<br>");
    ticket.issue = marked(tIssue);
    ticket.tags = tags;
    ticket.history = [HistoryItem];
    ticket.subscribers = [req.user._id];
    ticket.save(function(err, t) {
        if (err) {
            response.success = false;
            response.error = err;
            winston.debug(response);
            return res.status(400).json(response);
        }

        emitter.emit('ticket:created', {socketId: socketId, ticket: t});

        response.ticket = t;
        res.json(response);
    });
};

api_tickets.single = function(req, res, next) {
    var uid = req.params.uid;
    if (_.isUndefined(uid)) return res.status(200).json({'success': false, 'error': 'Invalid Ticket'});

    var ticketModel = require('../../../models/ticket');
    ticketModel.getTicketByUid(uid, function(err, ticket) {
        if (err) return res.send(err);

        if (_.isUndefined(ticket)
            || _.isNull(ticket))
            return res.status(200).json({'success': false, 'error': 'Invalid Ticket'});

        return res.json({'success': true, 'ticket': ticket});
    });
};

api_tickets.update = function(req, res, next) {
    var user = req.user;
    if (!_.isUndefined(user) && !_.isNull(user)) {
        var oId = req.params.id;
        var reqTicket = req.body;
        if (_.isUndefined(oId)) return res.send("Invalid Ticket Id");
        var ticketModel = require('../../../models/ticket');
        ticketModel.getTicketById(oId, function(err, ticket) {
            if (err) return res.send(err.message);

            //Check the user has permission to update ticket.

            if (!_.isUndefined(reqTicket.status))
                ticket.status = reqTicket.status;

            if (!_.isUndefined(reqTicket.group))
                ticket.group = reqTicket.group;

            if (!_.isUndefined(reqTicket.closedDate))
                ticket.closedDate = reqTicket.closedDate;

            ticket.save(function(err, t) {
                if (err) return res.send(err.message);

                emitter.emit('ticket:updated', t);

                return res.json(t);
            });
        });
    }
};

api_tickets.delete = function(req, res, next) {
    var oId = req.params.id;
    if (_.isUndefined(oId)) return res.send("Invalid Ticket Id");
    var ticketModel = require('../../../models/ticket');
    ticketModel.softDelete(oId, function(err) {
        if (err) return res.status(400).send(err.message);

        emitter.emit('ticket:deleted', oId);
        res.sendStatus(200);
    });
};

api_tickets.postComment = function(req, res, next) {
    var accessToken = req.headers.accesstoken;
    userSchema.getUserByAccessToken(accessToken, function(err, user) {
        if (err) return res.status(401).json({'error': err.message});
        if (!user) return res.status(401).json({'error': 'Unknown User'});

        var commentJson = req.body;
        var comment = commentJson.comment;
        var owner = commentJson.ownerId;
        var ticketId = commentJson._id;

        if (_.isUndefined(ticketId)) return res.send("Invalid Ticket Id");
        var ticketModel = require('../../../models/ticket');
        ticketModel.getTicketById(ticketId, function(err, t) {
            if (err) return res.send(err.message);

            if (_.isUndefined(comment)) return res.send("Invalid Comment");

            var marked = require('marked');
            comment = comment.replace(/(\r\n|\n\r|\r|\n)/g, "<br>");
            var Comment = {
                owner: owner,
                date: new Date(),
                comment: marked(comment)
            };

            t.updated = Date.now();
            t.comments.push(Comment);
            var HistoryItem = {
                action: 'ticket:comment:added',
                description: 'Comment was added',
                owner: user._id
            };
            t.history.push(HistoryItem);

            t.save(function(err, tt) {
                if (err) return res.send(err.message);

                ticketModel.populate(tt, 'comments.owner', function(err) {
                    if (err) return true;

                    emitter.emit('ticket:comment:added', tt, Comment);

                    res.json({ticket: tt});
                });
            });
        });
    });
};

api_tickets.getTypes = function(req, res, next) {
    var ticketType = require('../../../models/tickettype');
    ticketType.getTypes(function(err, types) {
        if (err) return res.send(err);

        res.json(types);
    })
};

api_tickets.getMonthData = function(req, res) {
    var ticketModel = require('../../../models/ticket');
    var now = new Date();
    var data = [];
    var newData = {data: [], label: 'New'};
    var closedData = {data: [], label: 'Closed'};

    var dates = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];


    async.series({
        total: function(cb) {
            async.forEachSeries(dates, function(value, next) {
                var d = [];
                var date = new Date(now.getFullYear(), value, 1).getTime();
                d.push(date);
                ticketModel.getMonthCount(value, -1, function(err, count) {
                    if (err) return next(err);

                    d.push(Math.round(count));
                    newData.data.push(d);
                    next();
                });
            }, function(err) {
                if (err) return cb(err);

                cb();
            });
        },
        closed: function(cb) {
            async.forEachSeries(dates, function(value, next) {
                var d = [];
                var date = new Date(now.getFullYear(), value, 1).getTime();
                d.push(date);
                ticketModel.getMonthCount(value, 3, function(err, count) {
                    if (err) return next(err);

                    d.push(Math.round(count));
                    closedData.data.push(d);
                    next();
                });
            }, function(err) {
                if (err) return cb(err);

                cb();
            });
        }
    }, function(err, done) {
        if (err) return res.status(400).send(err);

        data.push(newData);
        data.push(closedData);
        res.json(data);
    });
};

api_tickets.flotData = function(req, res) {

};

api_tickets.getYearData = function(req, res) {
    var ticketModel = require('../../../models/ticket');
    var year = req.params.year;

    var returnData = {};

    async.parallel({
        totalCount: function(next) {
            ticketModel.getYearCount(year, -1, function(err, count) {
                if (err) return next(err);

                next(null, count);
            });
        },

        closedCount: function(next) {
            ticketModel.getYearCount(year, 3, function(err, count) {
                if (err) return next(err);

                next(null, count);
            });
        }
    }, function(err, done) {
        returnData.totalCount = done.totalCount;
        returnData.closedCount = done.closedCount;

        res.json(returnData);
    });
};

/**
 * @api {get} /api/v1/tickets/count/topgroups/:topNum Top Groups Count
 * @apiName getTopTicketGroups
 * @apiDescription Gets the group with the top ticket count
 * @apiVersion 0.1.5
 * @apiGroup Ticket
 * @apiHeader {string} accesstoken The access token for the logged in user
 *
 * @apiExample Example usage:
 * curl -H "accesstoken: {accesstoken}" -l http://localhost/api/v1/tickets/count/topgroups/10
 *
 * @apiSuccess {array} items Array with Group name and Count
 *
 * @apiError InvalidPostData The data was invalid
 * @apiErrorExample
 *      HTTP/1.1 400 Bad Request
 {
     "error": "Invalid Request"
 }
 */
api_tickets.getTopTicketGroups = function(req, res) {
    var ticketModel = require('../../../models/ticket');
    var top = req.params.top;
    ticketModel.getTopTicketGroups(top, function(err, items) {
        if (err) return res.status(400).json({error: 'Invalid Request'});

        return res.json({items: items});
    });
};

api_tickets.removeAttachment = function(req, res) {
    var ticketId = req.params.tid;
    var attachmentId = req.params.aid;
    if (_.isUndefined(ticketId) || _.isUndefined(attachmentId)) return res.status(400).json({'error': 'Invalid Attachment'});

    //Check user perm
    var user = req.user;
    if (_.isUndefined(user)) return res.status(400).json({'error': 'Invalid User Auth.'});

    var permissions = require('../../../permissions');
    if (!permissions.canThis(user.role, 'tickets:removeAttachment')) return res.status(401).json({'error': 'Invalid Permissions'});

    var ticketModel = require('../../../models/ticket');
    ticketModel.getTicketById(ticketId, function(err, ticket) {
        if (err) return res.status(400).send('Invalid Ticket Id');
        ticket.getAttachment(attachmentId, function(a) {
            ticket.removeAttachment(user._id, attachmentId, function(err, ticket) {
                if (err) return res.status(400).json({'error': 'Invalid Request.'});

                var fs = require('fs');
                var path = require('path');
                var dir = path.join(__dirname, '../../../../public', a.path);
                if (fs.existsSync(dir)) fs.unlinkSync(dir);

                ticket.save(function(err, t) {
                    if (err) return res.status(401).json({'error': 'Invalid Request.'});
                    res.send(t);
                });
            });
        });
    });
};

api_tickets.subscribe = function(req, res) {
    var ticketId = req.params.id;
    var data = req.body;
    if (_.isUndefined(data.user) || _.isUndefined(data.subscribe)) return res.status(400).json({'error': 'Invalid Payload.'});

    var ticketModel = require('../../../models/ticket');
    ticketModel.getTicketById(ticketId, function(err, ticket) {
        if (err) return res.status(400).json({'error': 'Invalid Ticket Id'});

        async.series([
            function(callback) {
                if (data.subscribe) {
                    ticket.addSubscriber(data.user, function() {
                        callback();
                    });
                } else {
                    ticket.removeSubscriber(data.user, function() {
                        callback();
                    });
                }
            }
        ], function() {
            ticket.save(function(err) {
                if (err) return res.status(400).json({'error': err});

                emitter.emit('ticket:subscribers:update');

                res.json({'success': true});
            });
        });
    });
};

module.exports = api_tickets;