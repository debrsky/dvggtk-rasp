const config = require('../../../config');

const https = require('https');
const fs = require('fs');
const path = require('path');

const Papa = require('papaparse');

const URL_TEMPLATE = 'https://rasp.dvggtk.org/csv/{table}.csv';
const RASP_STORAGE = path.join(config.storage, 'rasp/csv');

const CLASSES_COUNT_IN_DAY = 8;
const CLASS_NUMBERS = Array.from(Array(CLASSES_COUNT_IN_DAY), (_, k) => k + 1);

const tables = [
	['UROKI', null], // must be at first place
	['SPGRUP', 'IDG'],
	['SPKAUD', 'IDA'],
	['SPPRED', 'IDD'],
	['SPPREP', 'IDP']
];
const refreshPeriod = 60 * 1000;

const db = Object.fromEntries(tables.map((table) => [table[0], null]));

const rasp = {
	getClassesByTeacher: function (dateFrom, dateTo, idp) {
		const res = [];

		const uroki = this.UROKI.filter(
			(row) =>
				row.DAT.getTime() >= dateFrom.getTime() &&
				row.DAT.getTime() <= dateTo.getTime() &&
				row.IDP === idp
		);

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

	res.room = rasp.SPKAUD[urok.IDA]?.KAUDI;
	res.discipline = rasp.SPPRED[urok.IDD].NAIM;
	res.teacher = rasp.SPPREP[urok.IDP].FAMIO;

	if (uroki.length === 1) {
		res.group = rasp.SPGRUP[urok.IDG].NAIM;
		res.subGroup = urok.IDGG;
		return res;
	}

	// Поток (т.е. несколько групп на одной паре)
	res.group = uroki.map((urok) => rasp.SPGRUP[urok.IDG].NAIM).join(', ');
	res.subGroup = 0;

	return res;
}

refresh();
setInterval(refresh, refreshPeriod);

function makeRasp(dataArray) {
	const idSets = {
		SPGRUP: new Set(),
		SPPREP: new Set(),
		SPKAUD: new Set()
	};

	dataArray.forEach(([table, data]) => {
		if (data) {
			db[table] = data;

			const [foundTable, foundTableIdField] = tables.find(
				([probeTable]) => probeTable === table
			);

			if (!foundTableIdField) {
				console.assert(table === 'UROKI');
				rasp.UROKI = data.filter((row) => row.IDR === 0);

				rasp.UROKI.forEach((row) => {
					tables.forEach(([table, id]) => {
						const idSet = idSets[table];
						if (idSet) idSet.add(row[id]);
					});
				});
				return;
			}

			const tableObject = {};
			const idSet = idSets[table];

			console.log(foundTableIdField);

			data.forEach((row) => {
				const id = row[foundTableIdField];
				if (!idSet || idSet.has(id)) {
					tableObject[id] = row;
				}
			});

			rasp[foundTable] = tableObject;
		}
	});
}

async function refresh() {
	await fs.promises.mkdir(RASP_STORAGE, {recursive: true});

	let dataArray;
	try {
		dataArray = await Promise.all(
			tables.map(([table]) =>
				(async () => {
					return [table, await getData(table)];
				})()
			)
		);
	} catch (err) {
		console.error(err);
		return;
	}

	if (dataArray) {
		makeRasp(dataArray);

		await fs.promises.writeFile(
			path.join(RASP_STORAGE, 'rasp.json'),
			JSON.stringify(rasp, null, 4),
			'utf-8'
		);
	}
}

function parseCsv(csv) {
	const db = Papa.parse(csv, {header: true, skipEmptyLines: true});

	db.data.forEach((el) => {
		for (const key of Object.keys(el)) {
			el[key] = typificate(key, el[key]);
		}
	});

	return db.data;
}

async function saveToFile(table, {csv, headers}) {
	try {
		await Promise.all([
			fs.promises.writeFile(path.join(RASP_STORAGE, `${table}.csv`), csv),
			fs.promises.writeFile(
				path.join(RASP_STORAGE, `${table}.meta.json`),
				JSON.stringify(headers)
			)
		]);
	} catch (err) {
		console.error(err);
	}
}

async function loadFromFile(table, resolve, reject) {
	let csv;
	try {
		csv = await fs.promises.readFile(
			path.join(RASP_STORAGE, `${table}.csv`),
			'utf-8'
		);
	} catch (err) {
		console.error(err);
		return reject(err);
	}
	const data = parseCsv(csv);
	return resolve(data);
}

async function getData(table) {
	const metaFile = path.join(RASP_STORAGE, `${table}.meta.json`);
	const csvFile = path.join(RASP_STORAGE, `${table}.csv`);

	let meta;
	try {
		await fs.promises.stat(csvFile);
		meta = JSON.parse(await fs.promises.readFile(metaFile));
	} catch (err) {
		if (err.code !== 'ENOENT') throw err;
	}

	const headers = {};
	if (meta) {
		headers['if-modified-since'] = meta['last-modified'];
		headers['if-none-match'] = meta.etag;
	}

	const executor = (resolve, reject) => {
		https
			.get(URL_TEMPLATE.replace('{table}', table), {headers}, async (res) => {
				if (res.statusCode === 304) {
					if (rasp[table]) return resolve(null); // no need to update table;

					loadFromFile(table, resolve, reject);
					return;
				}

				if (res.statusCode !== 200) {
					console.error(`${res.statusCode} ${res.statusMessage}`);
					loadFromFile(table, resolve, reject);
					return;
				}

				let csv = '';

				res.on('data', (d) => {
					csv += d;
				});

				res.once('error', (err) => {
					console.error(err);
					loadFromFile(table, resolve, reject);
				});

				res.once('end', async () => {
					await saveToFile(table, {csv, headers: res.headers});

					const data = parseCsv(csv);
					resolve(data);
				});
			})
			.once('error', (err) => {
				console.error(err);
				loadFromFile(table, resolve, reject);
			});
	};

	return new Promise(executor);
}

function typificate(key, value) {
	if (typeof value !== 'string') return value;
	if (['KAUDI', 'NAIM', 'MEMO', 'FAMIO'].includes(key)) return value;

	if (/^\d+$/i.test(value)) return parseInt(value);
	if (/^(true|false)$/i.test(value))
		return {true: true, false: false}[value.toLowerCase()];

	const match = value.match(
		/^(\d{1,2})[.-/](\d{1,2})[.-/](\d{4})\s+(\d|[:])+$/
	);
	if (match)
		return new Date(
			`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
		);

	return value;
}

module.exports = {rasp};
