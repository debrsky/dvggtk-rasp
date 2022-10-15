import rasp from '../pug/rasp.pug';

(async () => {
	const resArray = await Promise.allSettled(
		['/rasp/api/groups', '/rasp/api/teachers', '/rasp/api/rooms'].map((url) =>
			fetch(url)
		)
	);

	const [groups, teachers, rooms] = await Promise.all(
		resArray.map(({status, value}) => {
			if (status !== 'fulfilled') return Promise.resolve([]);
			const res = value;
			if (!res.ok) return Promise.resolve([]);
			return res.json();
		})
	);

	const groupElement = document.getElementById('group');
	const teacherElement = document.getElementById('teacher');
	const roomElement = document.getElementById('room');
	const timetableElement = document.getElementById('timetable');

	groups.forEach((group) => groupElement.add(new Option(group)));
	teachers.forEach((teacher) => teacherElement.add(new Option(teacher)));
	rooms.forEach((room) => roomElement.add(new Option(room)));

	const filterForm = document.forms.filter;
	filterForm.addEventListener('change', async (event) => {
		const {name, value} = event.target;

		[groupElement, teacherElement, roomElement].forEach((el) => {
			if (el.name !== name) el.value = '';
		});

		const {origin} = window.location;
		console.log(origin);

		const url = new URL(`${origin}/rasp/api/classes`);
		url.searchParams.set('dateFrom', filterForm.date.value);
		url.searchParams.set('dateTo', filterForm.date.value);
		url.searchParams.append(name, value);

		const res = await fetch(url);
		if (!res.ok) return;
		const classes = await res.json();

		console.log(classes);

		if (name === 'date') {
			timetableElement.innerHTML = rasp({rooms, classes});
		}
	});
})();
