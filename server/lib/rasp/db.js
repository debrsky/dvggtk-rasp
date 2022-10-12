const config = require('../../../config');

const fs = require('fs');
const path = require('path');

const download = require('./dowlnload');
const makeRasp = require('./make-rasp');

const RASP_STORAGE = path.join(config.rootDir, config.storage, 'rasp/csv');
const CLASSES_COUNT_IN_DAY = 8;
const CLASS_NUMBERS = Array.from(Array(CLASSES_COUNT_IN_DAY), (_, k) => k + 1);
const REFRESH_PERIOD = 60 * 1000;

const tables = [
	['UROKI', null, null], // must be at first place
	['SPGRUP', 'IDG', 'NAIM'],
	['SPKAUD', 'IDA', 'KAUDI'],
	['SPPRED', 'IDD', 'NAIM'],
	['SPPREP', 'IDP', 'FAMIO']
];

const db = Object.fromEntries(tables.map((table) => [table[0], null]));

const rasp = {
	get teachers() {
		return Object.values(this.data.SPPREP).map((row) => row.FAMIO);
	},
	findId: function (table, name) {
		const [, idField, nameField] = tables.find(
			([probeTable]) => probeTable === table
		);
		if (!idField || !nameField) throw Error();

		const foundRow = Object.values(this.data[table]).find(
			(row) => row[nameField] === name
		);
		if (!foundRow) return null;

		return foundRow[idField];
	},

	getClassesByTeacher: function (dateFrom, dateTo, teacher) {
		const idp = this.findId('SPPREP', teacher);
		const dFrom = new Date(dateFrom);
		const dTo = new Date(dateTo);
		if (!idp || isNaN(dFrom.getTime()) || isNaN(dTo.getTime()))
			throw new Error(
				`Wrong parameters: ${JSON.stringify({dateFrom, dateTo, teacher})}`
			);

		console.log('idp', idp);

		const res = [];

		const uroki = this.data.UROKI.filter(
			(row) =>
				row.DAT.getTime() >= dFrom.getTime() &&
				row.DAT.getTime() <= dTo.getTime() &&
				row.IDP === idp
		);

		let date = new Date(dFrom);
		while (date.getTime() <= dTo.getTime()) {
			const urokiByDay = uroki.filter(
				(row) => row.DAT.getTime() === date.getTime()
			);

			const classes = CLASS_NUMBERS.map((n) => {
				const urokiByUr = urokiByDay.filter((row) => row.UR === n);
				if (urokiByUr.length === 0) return null;

				return getClass(urokiByUr);
			});

			res.push({date: date.toISOString().slice(0, 10), classes});

			date = new Date(date.getTime() + 24 * 60 * 60 * 1000); // next date
		}

		// const res = Array.from(Array(8), (_, k) => k + 1);

		return res;
	},
	getClassesByGroup: function (dateFrom, dateTo, idg) {},
	getClassesByRoom: function (dateFrom, dateTo, ida) {}
};

function getClass(uroki) {
	if (!(uroki?.length > 0)) return null;

	const res = {};
	const urok = uroki[0];

	res.room = rasp.data.SPKAUD[urok.IDA]?.KAUDI;
	res.discipline = rasp.data.SPPRED[urok.IDD].NAIM;
	res.teacher = rasp.data.SPPREP[urok.IDP].FAMIO;

	if (uroki.length === 1) {
		res.group = rasp.data.SPGRUP[urok.IDG].NAIM;
		res.subGroup = urok.IDGG;
		return res;
	}

	// Поток (т.е. несколько групп на одной паре)
	res.group = uroki.map((urok) => rasp.data.SPGRUP[urok.IDG].NAIM).join(', ');
	res.subGroup = 0;

	return res;
}

refresh();
setInterval(refresh, REFRESH_PERIOD);

async function refresh() {
	if ((await download(db)).hasNewData) {
		makeRasp(tables, db, rasp);

		await fs.promises.writeFile(
			path.join(RASP_STORAGE, 'rasp.json'),
			JSON.stringify(rasp, null, 4),
			'utf-8'
		);
	}
}

module.exports = {rasp};
