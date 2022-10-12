const express = require('express');
const router = express.Router();

const {table} = require('table');

const {rasp} = require('../../lib/rasp/db');

router.get('/', function (req, res, next) {
	const {query} = req;

	const teacher = query.teacher;

	const dateFrom = (() => {
		const d = new Date(Date.parse(query.date));
		if (!isNaN(d)) return d;
		return new Date(new Date().toDateString());
	})();

	const dateTo = new Date(dateFrom);
	dateTo.setDate(dateTo.getDate() + 2);

	const classes = rasp.getClassesByTeacher(dateFrom, dateTo, teacher);

	// console.log(classes[0].classes);

	const tableConfig = {
		spanningCells: [],
		columns: {1: {width: 20}, 2: {width: 20}}
	};
	const data = classes[0].classes.map((el, idx) => {
		if (!el) {
			tableConfig.spanningCells.push({col: 1, row: idx, colSpan: 2});
			return [idx + 1, '', ''];
		}

		const classText = `${el.group} ${el.discipline} ${el.room}`;

		if (el.subGroup === 0) {
			tableConfig.spanningCells.push({col: 1, row: idx, colSpan: 2});
			return [idx + 1, classText, ''];
		}
		if (el.subGroup === 1) {
			return [idx + 1, classText, ''];
		}

		return [idx + 1, '', classText];
	});
	console.log(data);
	console.log(table(data, tableConfig));

	res.render('rasp/start', {
		rasp,
		classes,
		dateFrom,
		dateTo,
		teacher,
		stringTable: table(data, tableConfig)
	});
});

module.exports = router;
