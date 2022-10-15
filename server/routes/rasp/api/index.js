const express = require('express');
const router = express.Router();

const {rasp} = require('../../../lib/rasp/index.js');

function getDate(str) {
	if (!str) {
		const now = new Date();
		return new Date(
			`${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
		);
	}

	const d = new Date(Date.parse(str));
	if (!isNaN(d)) return d;

	return new Date(new Date().toDateString()); // cut off time part;
}

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

	const dateFrom = getDate(query.dateFrom);
	const dateTo = getDate(query.dateTo);

	const {teacher, group, room} = query;

	res.json({
		dateFrom,
		dateTo,
		classesByDate: rasp.getClasses(dateFrom, dateTo, {teacher, group, room})
	});
});

module.exports = router;
