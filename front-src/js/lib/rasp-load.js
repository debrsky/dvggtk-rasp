import convolution from './convolution.js';

function getClassesConvolution(classesByKey) {
	return Object.fromEntries(
		Object.entries(classesByKey).map(([key, classesByNumber]) => {
			return [
				key,
				classesByNumber.map((cls) => {
					if (Array.isArray(cls)) return convolution('subGroup', cls);
					if (cls) return convolution('subGroup', [cls]);
					return cls;
				})
			];
		})
	);
}

const {origin} = window.location;

export async function loadEntities(keys) {
	return Promise.all(
		keys.map((key) =>
			fetch('/rasp/api/' + encodeURIComponent(key)).then((res) => {
				if (!res.ok) throw new Error();
				return res.json();
			})
		)
	);
}

export async function loadClassesByDate(
	dateFrom,
	dateTo,
	{teacher, group, room}
) {
	const url = new URL(`${origin}/rasp/api/classes/bydate`);
	url.searchParams.set('dateFrom', dateFrom);
	url.searchParams.set('dateTo', dateTo);

	const [paramName, paramValue] =
		Object.entries(
			(() => {
				if (teacher) return {teacher};
				if (group) return {group};
				if (room) return {room};
				return {};
			})()
		)?.[0] ?? [];

	url.searchParams.set(paramName, paramValue);

	const rawClasses = await fetch(url).then((res) => {
		if (!res.ok) throw new Error();
		return res.json();
	});

	return {
		classesByDate: getClassesConvolution(rawClasses.classesByDate)
	};
}

export async function loadClassesBySubject(date, subject) {
	const url = new URL(`${origin}/rasp/api/classes/bysubject`);
	url.searchParams.set('date', date);
	url.searchParams.set('subject', subject);

	const rawClasses = await fetch(url).then((res) => {
		if (!res.ok) throw new Error();
		return res.json();
	});

	return {
		classesBySubject: getClassesConvolution(rawClasses.oneDayClasses)
	};
}
