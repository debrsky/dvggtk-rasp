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

function compareSp(a, b) {
	if (a.name < b.name) return -1;
	if (a.name > b.name) return 1;
	return 0;
}

const spMetaData = {
	teachers: {table: 'SPPREP', idField: 'IDP', nameField: 'FAMIO'},
	groups: {table: 'SPGRUP', idField: 'IDG', nameField: 'NAIM'},
	rooms: {table: 'SPKAUD', idField: 'IDA', nameField: 'KAUDI'}
};

const rasp = {
	data: {},
	dataLastChecked: null,
	cache: {},
	hasNewData: function () {
		const res = this.data !== this.dataLastChecked;
		this.dataLastChecked = this.data;

		return res;
	},
	getSp: function (sp) {
		const {table, idField, nameField} = spMetaData[sp];
		if ((!this.cache[sp] || this.hasNewData()) && this.data[table]) {
			this.cache[sp] = Object.values(this.data[table])
				.map((row) => ({
					id: row[idField],
					name: row[nameField]
				}))
				.sort(compareSp);
		}

		return this.cache[sp] ?? [];
	},

	get teachers() {
		return this.getSp('teachers');
	},

	get groups() {
		return this.getSp('groups');
	},

	get rooms() {
		return this.getSp('rooms');
	},

	getClassesByDate: function (dateFrom, dateTo, {teacher, group, room}) {
		const filters = [];
		[
			['teachers', teacher],
			['groups', group],
			['rooms', room]
		].forEach(([key, value]) => {
			const {table, idField} = spMetaData[key];
			const id = this.findId(table, value);
			if (value) filters.push([idField, id]);
		});

		const uroki = this.data.UROKI.filter(
			(row) =>
				row.DAT.getTime() >= dateFrom.getTime() &&
				row.DAT.getTime() <= dateTo.getTime() &&
				filters.every(([idField, idValue]) => row[idField] === idValue)
		);

		const classesByDate = {};

		let date = new Date(dateFrom);
		while (date.getTime() <= dateTo.getTime()) {
			const urokiByDay = uroki.filter(
				(row) => row.DAT.getTime() === date.getTime()
			);

			const classes = CLASS_NUMBERS.map((n) => {
				const urokiByUr = urokiByDay.filter((row) => row.UR === n);
				if (urokiByUr.length === 0) return null;

				return getClass(urokiByUr);
			});

			const dateStr = date.toISOString().slice(0, 10);
			classesByDate[dateStr] = classes;

			date = new Date(date.getTime() + 24 * 60 * 60 * 1000); // next date
		}

		return classesByDate;
	},

	getOneDayClasses: function (date, subject) {
		if (!['groups', 'teachers', 'rooms'].includes(subject)) throw new Error();

		const DAT = new Date(date);
		const {table, idField, nameField} = spMetaData[subject];

		const uroki = this.data.UROKI.filter(
			(row) => row.DAT.getTime() === DAT.getTime()
		);

		const oneDayClasses = {};
		Object.values(this.data[table]).forEach((spRow) => {
			const urokiBySubject = uroki.filter(
				(urokRow) => urokRow[idField] === spRow[idField]
			);

			const classes = CLASS_NUMBERS.map((n) => {
				const urokiByUr = urokiBySubject.filter((row) => row.UR === n);
				if (urokiByUr.length === 0) return null;

				return getClass(urokiByUr);
			});

			oneDayClasses[spRow[nameField]] = classes;
		});

		return oneDayClasses;
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
	}
};

function getClass(uroki) {
	if (!(uroki?.length > 0)) return null;

	const res = uroki.map((urok) => ({
		room: rasp.data.SPKAUD[urok.IDA]?.KAUDI ?? null,
		discipline: rasp.data.SPPRED[urok.IDD]?.NAIM ?? null,
		teacher: rasp.data.SPPREP[urok.IDP]?.FAMIO ?? null,
		group: rasp.data.SPGRUP[urok.IDG]?.NAIM ?? null,
		subGroup: urok.IDGG
		// ,src: urok
	}));

	if (uroki.length === 1) return res[0];

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
