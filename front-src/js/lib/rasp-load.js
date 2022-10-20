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

export async function loadClasses(dateFrom, dateTo, {teacher, group, room}) {
	const {origin} = window.location;
	const url = new URL(`${origin}/rasp/api/classes`);
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
		classesByDate: Object.fromEntries(
			Object.entries(rawClasses.classesByDate).map(
				([date, classesByNumber]) => {
					return [
						date,
						classesByNumber.map((cls) => {
							if (Array.isArray(cls)) return convolution('subGroup', cls);
							if (cls) return convolution('subGroup', [cls]);
							return cls;
						})
					];
				}
			)
		)
	};
}

function convolution(field, arr) {
	if (!Array.isArray(arr)) throw new Error();

	const res = {};

	arr.forEach((row) => {
		const groupValue = row[field];
		if (!res[groupValue]) res[groupValue] = {...row};
		Object.entries(row).forEach(([key, value]) => {
			if (res[groupValue][key]?.toString() === '[object Set]') {
				res[groupValue][key].add(value);
				return;
			}
			res[groupValue][key] = new Set([res[groupValue][key]]);
			res[groupValue][key].add(value);
		});
	});

	const resStage2 = Object.entries(res).map(([groupValue, row]) => {
		const newGroupValue =
			groupValue === '0' || groupValue === '1' ? groupValue : '2';
		return [newGroupValue, row];
	});

	const resStage3 = resStage2.map(([groupValue, row]) => {
		const newRow = Object.fromEntries(
			Object.entries(row).map(([key, value]) => {
				let newValue;
				if (value?.toString() === '[object Set]') {
					newValue = Array.from(value);
					if (newValue.length === 1) newValue = newValue[0];
				} else {
					newValue = value;
				}

				return [key, newValue];
			})
		);

		return [groupValue, newRow];
	});

	return Object.fromEntries(resStage3);
}
