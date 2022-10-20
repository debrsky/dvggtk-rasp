const createError = require('http-errors');
const express = require('express');
const router = express.Router();

const {rasp} = require('../../../lib/rasp/index.js');

function getDateFrom(str) {
	if (!str) {
		const now = new Date();
		return new Date(
			`${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
		);
	}

	return new Date(Date.parse(str));
}

router.get('/period', (req, res, next) => {
	res.json({
		dateStart: rasp.dateStart.toISOString().slice(0, 10),
		dateEnd: rasp.dateEnd.toISOString().slice(0, 10)
	});
});

router.get('/teachers', (req, res, next) => {
	res.json(rasp.teachers.map((el) => el.name));
});

router.get('/groups', (req, res, next) => {
	res.json(rasp.groups.map((el) => el.name));
});

router.get('/rooms', (req, res, next) => {
	res.json(rasp.rooms.map((el) => el.name));
});

router.get('/classes', (req, res, next) => {
	const query = req.query;

	const dateFrom = getDateFrom(query.dateFrom);
	const dateTo = getDateFrom(query.dateTo);

	if (isNaN(dateFrom.getTime()))
		return next(createError(400, `Wrong date: ${query.dateFrom}`));
	if (isNaN(dateTo.getTime()))
		return next(createError(400, `Wrong date: ${query.dateTo}`));

	const {teacher, group, room} = query;

	res.json({
		dateFrom: dateFrom.toISOString().slice(0, 10),
		dateTo: dateTo.toISOString().slice(0, 10),
		classesByDate: rasp.getClassesByDate(dateFrom, dateTo, {
			teacher,
			group,
			room
		})
	});
});

module.exports = router;
