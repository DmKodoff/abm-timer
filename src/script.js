// API URL
const API_URL = 'https://api.worldwideshop.ru/time/get/';

// идентификаторы юнитов крона
const CRON_SECONDS_ID = 0;
const CRON_MINUTES_ID = 1;
const CRON_HOURS_ID = 2;
const CRON_DATES_ID = 3;
const CRON_MONTHS_ID = 4;
const CRON_DAYS_ID = 5;
const CRON_YEARS_ID = 6;

// Часовые пояса, данные подтягиваются по API.
// На данный момент это нужно только для названий городов.
const timezones = {
    /*
    'Europe/Moscow': {
        cityTime: 'по московскому времени',
    },
    ...
     */
};

// Карты переназначения смещений, подтягиваются по API.
// К примеру, если событие, до которого отсчитывает таймер, начинается в 8 часов по нескольким разным смещениям,
// то нам потребуется карта переназначений смещений, чтобы объединить вместе ближайшие смещения.
//
// Синтаксис:
//
// const offsetMaps = {
//     mapId: [
//         [target, to],
//         [-180, -60],
//         ...
//     ],
// };
//
// mapId - идентификатор карты, который мы можем назначить в параметр data-offset.
// target - итоговое смещение, которое будет назначено.
// to - если смещение пользователя меньше, либо равно этому значению, тогда target принимаем за
// смещение для всего таймера. Если значение отсутствует, тогда считаем его за подходящее (за бесконечность).
const offsetMaps = {
    /*
    gb: [
        [-600, -600],
        [-540, -540],
        [-480, -480],
        [-420, -420],
        [-360, -360],
        [-300, -300],
        [-180, -180],
        [-120, -120],
        [-60, -60],
        [300],
    ],
    ...
    */
};

// юниты крона
const CRON_UNITS = [
    { // секунды
        min: 0,
        max: 59,
        default: '0',
    },
    { // минуты
        min: 0,
        max: 59,
        default: '0',
    },
    { // часы
        min: 0,
        max: 23,
        default: '0',
    },
    { // дни месяца
        min: 1,
        max: 31,
        default: '*',
    },
    { // месяцы
        min: 1,
        max: 12,
        default: '*',
        alt: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
    },
    { // дни недели
        min: 0,
        max: 6,
        default: '*',
        alt: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
        sundayFix: true,
    },
    { // годы
        min: 1970,
        max: 2099,
        default: '*',
    },
];

// функция получает смещение по карте
const getOffsetFromMap = (mapId, offset) => {
    let result = false;
    try {
        if (offsetMaps[mapId]) {
            const list = offsetMaps[mapId];
            for (let i = 0; i < list.length; i++) {
                const pair = list[i];
                const target = parseInt(pair[0]);
                const to = pair.length > 1 ? parseInt(pair[1]) : Infinity;
                if (offset <= to) {
                    result = target;
                    break;
                }
            }
        }
    } catch (e) {
        // do nothing
    }
    return result;
};

// функция отдаёт название часовой зоны из Internationalization API
const getIntlTimezone = () => {
    try {
        if (Intl) {
            const format = Intl.DateTimeFormat();
            if (format) {
                const options = format.resolvedOptions();
                if (options && options.timeZone) {
                    // название зоны найдено, возвращаем
                    return options.timeZone;
                }
            }
        }
    } catch (e) {
        // ничего не делаем
    }
    return false;
};

// функция возвращает название времени по городу
const getCityTime = () => {
    const timezone = getIntlTimezone();
    const data = timezones[timezone];
    return (data && data.cityTime) || false;
};
window.getCityTime = getCityTime;

// функция возвращает текущее смещение клиента
const getTimezoneOffset = () => {
    const d = new Date();
    return d.getTimezoneOffset();
};

// функция парсинга cron-выражения
const parseCronExpression = str => {
    // заполнение массива по диапазону значений
    const fillRange = (from, to) => {
        const result = [];
        for (let i = from; i <= to; i++) {
            result.push(i);
        }
        return result;
    };

    // функция парсинга частей значений
    const parseChunk = (chunk, unitId) => {
        const unit = CRON_UNITS[unitId];

        // разбиваем строку по знаку приращения
        const pair = chunk.split('/');
        if (pair.length > 2) {
            throw new Error(`Некорректное приращение "${chunk}"`);
        }
        const value = pair[0] === '*' ? unit.min + '-' + unit.max : pair[0];
        const step = pair.length > 1 ? parseInt(pair[1], 10) : null;
        if (step !== null && (isNaN(step) || step < 1)) {
            throw new Error(`Некорректный коэффициент приращения "${pair[1]}"`);
        }

        // подготавливаем карту для альтернативных значений
        const altMap = {};
        if (unit.alt) {
            for (let i = 0; i < unit.alt.length; i++) {
                altMap[unit.alt[i]] = i + unit.min;
            }
        }

        // функция для считывания значения
        const parseNumber = num => {
            let result = num;
            if (typeof altMap[num] !== 'undefined') {
                result = altMap[num];
            }
            result = parseInt(result, 10);
            if (isNaN(result)) {
                throw new Error(`Некорректное значение "${num}"`);
            }
            return result;
        };

        // считываем диапазоны, либо сами значения
        let parsed;
        let minRange = null;
        let maxRange = null;
        const parts = value.split('-');
        if (parts.length > 0) {
            minRange = parseNumber(parts[0]);
        }
        if (parts.length === 1) {
            parsed = [minRange];
        } else if (parts.length === 2) {
            maxRange = parseNumber(parts[1]);
            if (maxRange < minRange) {
                throw new Error(`Максимальное значение диапазона меньше, чем минимальное "${value}"`);
            }
            parsed = fillRange(minRange, maxRange);
        } else {
            throw new Error(`Некорректный диапазон "${value}"`);
        }

        // приращение
        if (step !== null) {
            // если нет диапазона, заполняем до максимума
            if (maxRange === null) {
                parsed = fillRange(minRange, unit.max);
            }

            // вычищаем значения, не подходящие по шагу
            parsed = parsed.filter(value => (value - minRange) % step === 0);
        }

        // если дни недели, фиксим воскресенье
        if (unit.sundayFix) {
            parsed = parsed.map(value => value === 7 ? 0 : value);
        }

        return parsed;
    };

    // функция парсинга значений
    const parseValue = (value, unitId) => {
        const unit = CRON_UNITS[unitId];

        let result = value.split(',').map(chunk => {
            let result = [unit.min];
            try {
                result = parseChunk(chunk, unitId);
            } catch (e) {
                console.error(`Ошибка парсинга "${value}": ${e.message}`);
            }
            return result;
        });

        // объединяем массивы
        result = [].concat.apply([], result);

        // удаляем дубли
        const unique = [];
        result.forEach(i => {
            if (unique.indexOf(i) < 0) {
                unique.push(i);
            }
        });
        result = unique;

        // сортируем
        result = result.sort((a, b) => a - b);

        // проверяем, выходит ли за пределы возможных значений
        const minValue = result[0];
        const maxValue = result[result.length - 1];
        let outOfRange = null;
        if (minValue < unit.min) {
            outOfRange = minValue;
        } else if (maxValue > unit.max) {
            outOfRange = maxValue;
        }
        if (outOfRange !== null) {
            console.error(`Значение выходит за пределы возможных "${outOfRange}" в "${value}"`);
        }

        return result;
    };

    // разделяем значения по пробелам
    const values = str.replace(/\s+/g, ' ').trim().split(' ');

    // если недостаточно значений, прибавляем дефолтные
    for (let i = (CRON_UNITS.length - 1) - values.length - 1; i >= 0; i--) {
        values.unshift(CRON_UNITS[i].default);
    }

    // добавляем год, если нету
    if (values.length === CRON_UNITS.length - 1) {
        values.push(CRON_UNITS[CRON_YEARS_ID].default);
    }

    // парсим значения и возвращаем массивы
    return values.map((value, unitId) => parseValue(value, unitId));
};

// функция поиска последнего совпадения времени спарсенного cron-выражения
const cronLastRun = (exp, from) => {
    // переменные
    let current = new Date(from); // текущая дата
    let state; // текущее состояние

    // функция обновления состояния согласно дате
    const updateState = () => {
        state = [
            current.getUTCSeconds(),
            current.getUTCMinutes(),
            current.getUTCHours(),
            current.getUTCDate(),
            current.getUTCMonth() + 1,
            current.getUTCDay(),
            current.getUTCFullYear(),
        ]
    };

    // функция проверки, подходит ли текущее значение юнита
    const compared = unitId => exp[unitId].indexOf(state[unitId]) !== -1;

    // функция отрезает лишнее от текущего времени
    const cutTime = (unitId = -1) => {
        if (unitId >= CRON_SECONDS_ID) {
            current.setUTCSeconds(0);
        }
        if (unitId >= CRON_MINUTES_ID) {
            current.setUTCMinutes(0);
        }
        if (unitId >= CRON_HOURS_ID) {
            current.setUTCHours(0);
        }
        if (unitId >= CRON_DAYS_ID) {
            current.setUTCDate(1);
        }
        if (unitId >= CRON_MONTHS_ID) {
            current.setUTCMonth(0);
        }

        // отнимаем одну секунду, чтобы сбросить все значения на максимальные
        // (хорошо, что в js отсутсвуют вещи вроде leap seconds)
        current = new Date(current.getTime() - 1000);

        // обновляем состояние
        updateState();
    };

    // функция подбирает ближайший подходящий день
    const findDay = () => {
        for (let y = state[CRON_YEARS_ID]; y >= CRON_UNITS[CRON_YEARS_ID].min; y--) {
            if (compared(CRON_YEARS_ID)) {
                for (let m = state[CRON_MONTHS_ID]; m >= 1; m--) {
                    if (compared(CRON_MONTHS_ID)) {
                        for (let d = state[CRON_DATES_ID]; d >= 1; d--) {
                            if (compared(CRON_DATES_ID) && compared(CRON_DAYS_ID)) {
                                return true;
                            } else {
                                cutTime(CRON_HOURS_ID);
                            }
                        }
                    } else {
                        cutTime(CRON_DAYS_ID);
                    }
                }
            } else {
                cutTime(CRON_MONTHS_ID);
            }
        }
        return false;
    };

    // функция подбирает ближайшее подходящее время
    const findTime = () => {
        for (let h = state[CRON_HOURS_ID]; h >= CRON_UNITS[CRON_HOURS_ID].min; h--) {
            if (compared(CRON_HOURS_ID)) {
                for (let m = state[CRON_MINUTES_ID]; m >= CRON_UNITS[CRON_MINUTES_ID].min; m--) {
                    if (compared(CRON_MINUTES_ID)) {
                        for (let s = state[CRON_SECONDS_ID]; s >= CRON_UNITS[CRON_SECONDS_ID].min; s--) {
                            if (compared(CRON_SECONDS_ID)) {
                                return true;
                            }
                            // вычитаем всего лишь одну секунду
                            cutTime();
                        }
                    } else {
                        cutTime(CRON_SECONDS_ID);
                    }
                }

            } else {
                cutTime(CRON_MINUTES_ID);
            }
        }
        return false;
    };

    // ищем подходящий день
    updateState();
    if (!findDay()) {
        // если дня не существует
        return false;
    }

    // если время ещё не наступило, пытаемся продолжить искать со вчерашнего дня
    if (!findTime()) {
        if (!findDay()) {
            // если дня не существует
            return false;
        }
        findTime();
    }

    // возвращаем количество времени, прошедшее с найденной текущей даты
    return from - current.getTime();
};

// функция склонения существительных после числительных
// const declOfNum = (n, t) => t[(n % 100 > 4 && n % 100 < 20) ? 2 : [2, 0, 1, 1, 1, 2][(n % 10 < 5) ? n % 10 : 5]];
const declOfNum = (number, titles) => {
    const cases = [2, 0, 1, 1, 1, 2];
    return titles[
        (number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]
    ];
};

// функция создания нового элемента
const newElement = (parentElement, className) => {
    const element = parentElement.ownerDocument.createElement('div');
    element.className = className;
    parentElement.appendChild(element);
    return element;
};

// функция добавляет property второго объекта к первому
const assignToObject = (dest, ...sources) => {
    for (let index = 0; index < sources.length; index++) {
        const source = sources[index];
        if (source !== undefined && source !== null) {
            for (let nextKey in source) {
                if (source.hasOwnProperty(nextKey)) {
                    dest[nextKey] = source[nextKey];
                }
            }
        }
    }
};

// функция форматирует текст, расставляет переменные
const formatText = (text, data) => {
    // массив с переменными для замены
    const vars = {};

    // функция добавления даты в переменные
    const addDate = (date, suffix = '') => {
        const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        vars['d' + suffix] = date.getDate();
        vars['m' + suffix] = months[date.getMonth()];
        vars['h' + suffix] = ('0' + date.getHours()).substr(-2);
        vars['i' + suffix] = ('0' + date.getMinutes()).substr(-2);
    };

    // добавляем даты
    addDate(data.date);
    const date2 = new Date(data.date.getTime() + data.duration * 1000);
    addDate(date2, '2');

    // добавляем город
    vars['ct'] = data.cityTime || 'по вашему времени';

    // заменяем переменные в тексте
    let result = text;
    for (let name in vars) {
        if (vars.hasOwnProperty(name)) {
            result = result.replace('{' + name + '}', vars[name]);
        }
    }

    // вставляем span для стилизации
    result = result.replace('(', '<span>');
    result = result.replace(')', '</span>');

    return result;
};

((win, doc) => {
    let loadedTime = (new Date()).getTime();
    let loadedLocalTime = loadedTime;

    // 0: неизвестно, 1: загружено, -1: ошибка загрузки
    let APIState = 0;

    // массив со всеми объектами таймеров
	const timers = [];

	const setDataAll = () => {
	    for (let i = 0; i < timers.length; i++) {
            timers[i].setData();
        }
    };

    const http = new XMLHttpRequest();
    http.onreadystatechange = () => {
        if (http.readyState === 4 && http.status === 200){
            const data = http.responseText;
            try {
                const parsed = JSON.parse(data);
                if (parsed.time) {
                    loadedTime = parsed.time * 1000;
                    loadedLocalTime = (new Date()).getTime();
                    APIState = 1;

                    // грузим часовые пояса и карты смещений
                    assignToObject(timezones, parsed.timezones);
                    assignToObject(offsetMaps, parsed.offsetMaps);
                } else {
                    APIState = -1;
                }
            } catch (e) {
                APIState = -1;
            }
            setDataAll();
        }
    };
    http.onerror = () => {
        APIState = -1;
        setDataAll();
    };
    http.open('GET', API_URL, true);
    http.send();

    // если через секунду не получили дату с API, то берём её с клиента
    setTimeout(() => {
        if (APIState === 0) {
            APIState = -1;
            setDataAll();
        }
    }, 1000);

	class Timer {
		container = null; // DOM элемент контейнера
		childrenElements = {}; // все созданные дочерние элементы
		dataInitialized = false;
		zeroInitialized = true;

        static className = '__abm_timer'; // название css-класса контейнера

        constructor (container) {
            // сохраняем ссылку на контейнер
            this.container = container;

            // считываем опции с контейнера
            this.updateOptions();

            // создаём дочерние элементы
            this.build();

            // стартуем таймер
            this.tick();

            // устанавливаем флаг завершения инициализации
            this.container.setAttribute('data-init', '1');
        }

        updateOptions () {
            // считываем время последнего запуска
            let starts = this.container.getAttribute('data-starts') || '0 0 0 * * * *';

            // если старый формат, преобразуем
            const startsValues = starts.split(' ');
            if (startsValues.length === 2) {
                starts = '0 0 ' + startsValues[1] + ' * * ' + startsValues[0] + ' *';
            }

            // парсим время последних запусков
            this.startsSet = starts.split('|').map(s => parseCronExpression(s.trim()));

            // парсим интервалы
            let interval = this.container.getAttribute('data-interval') || (24 * 3600) + '';
            this.intervalSet = interval.split('|').map(s => eval(s));

            // если количество стартов и интервалов не совпадает, кидаем ошибку
            if (this.startsSet.length !== this.intervalSet.length) {
                console.error('Количество стартов и интервалов не совпадает');
            }

            this.duration = eval(this.container.getAttribute('data-duration') || 0);

            this.caption1 = this.container.getAttribute('data-caption1') || this.container.getAttribute('data-c1') || '';
            this.caption2 = this.container.getAttribute('data-caption2') || this.container.getAttribute('data-c2') || '';
            this.caption3 = this.container.getAttribute('data-caption3') || this.container.getAttribute('data-c3') || '';

            this.offset = this.container.getAttribute('data-offset') || 0;

            const days = this.container.getAttribute('data-days') || 'yes';
            this.showDays = days === 'yes' || days === 'true' || days === '1';

            const reload = this.container.getAttribute('data-reload') || false;
            this.reload = reload === 'yes' || reload === 'true' || reload === '1';

            const targetOffset = this.container.getAttribute('data-target-offset') || 'auto';
            this.targetOffset = targetOffset === 'auto' ? getTimezoneOffset() : parseInt(targetOffset, 10);

            this.redirect = this.container.getAttribute('data-redirect');
        }

        build () {
            // функция создания нового элемента внутри элементов контейнера
            const add = (parent, id, classSuffix, content = '') => {
                const element = newElement(this.childrenElements[parent] || this.container, Timer.className + '_' + classSuffix);
                this.childrenElements[id] = element;
                element.innerHTML = content;
                return element;
            };

            add(null, 'c0', 'c0');
            add('c0', 'c1', 'c1', this.caption1 ? '...' : '');
            add('c0', 'c2', 'c2', this.caption2 ? '...' : '');
            add('c0', 'c3', 'c3', this.caption3 ? '...' : '');
            add(null, 'b0', 'b0');
            for (let i = 0; i <= 3; i++) {
                const b1 = add('b0', 'b1_' + i, 'b1');
                if (!this.showDays && i === 0) {
                    b1.style.display = 'none';
                }
                add('b1_' + i, 'b2_' + i, 'b2');
                add('b1_' + i, 'label_' + i, 'b3');
                add('b2_' + i, 'd_' + i + '_1', 'b4');
                add('b2_' + i, 'd_' + i + '_2', 'b4');
            }
        }

        setData () {
            // находим смещение
            let offset = 0;
            if (this.offset === 'auto') {
                offset = getTimezoneOffset();
            } else if (offsetMaps[this.offset]) {
                const offsetByMap = getOffsetFromMap(this.offset, getTimezoneOffset());
                if (offsetByMap === false) {
                    console.error('Смещение по карте не найдено');
                } else {
                    offset = offsetByMap;
                }
            } else {
                offset = parseInt(this.offset) || 0;
            }

            // сколько времени назад был в последний раз назначен старт
            let lastRun = false;
            let startIndex = 0;
            this.startsSet.forEach((start, index) => {
                const l = cronLastRun(start, loadedTime - offset * 60 * 1000);
                if (l < lastRun || lastRun === false) {
                    lastRun = l;
                    startIndex = index;
                }
            });
            this.interval = this.intervalSet[startIndex];

            // если стартов ещё не было
            if (lastRun === false) {
                console.error('Время запуска таймера ещё не наступило!');
                lastRun = this.interval;
            } else {
                // иначе округляем до секунд
                lastRun = Math.floor(lastRun / 1000);
            }

            // устанавливаем оставшееся время
            this.timeLeft = this.interval - lastRun;

            // устанавливаем заголовки
            const targetDate = new Date(loadedTime + this.timeLeft * 1000 + (getTimezoneOffset() - this.targetOffset) * 60 * 1000);
            const formatData = {
                date: targetDate,
                duration: this.duration,
                cityTime: getCityTime(),
            };
            this.childrenElements['c1'].innerHTML = formatText(this.caption1, formatData);
            this.childrenElements['c2'].innerHTML = formatText(this.caption2, formatData);
            this.childrenElements['c3'].innerHTML = formatText(this.caption3, formatData);

            const wasInitialized = this.dataInitialized;
            this.dataInitialized = true;
            if (!wasInitialized) {
                this.update();
            }
        }

        update () {
            let timeLeft = this.dataInitialized ? this.timeLeft : 0;

            const timePassed = Math.floor(((new Date()).getTime() - loadedLocalTime) / 1000);
            timeLeft -= timePassed;

            if (timeLeft < 0) {
                timeLeft = 0;
            }

            let remains = timeLeft;
            let days = Math.floor(remains / (3600 * 24));
            remains -= days * (3600 * 24);
            let hours = Math.floor(remains / 3600);
            remains -= hours * 3600;
            let minutes = Math.floor(remains / 60);
            remains -= minutes * 60;
            let seconds = remains;

            const daysText = this.dataInitialized ? declOfNum(days, ['день', 'дня', 'дней']) : '...';
            const hoursText = this.dataInitialized ? declOfNum(hours, ['час', 'часа', 'часов']) : '...';
            const minutesText = this.dataInitialized ? declOfNum(minutes, ['минута', 'минуты', 'минут']) : '...';
            const secondsLabel = this.dataInitialized ? declOfNum(seconds, ['секунда', 'секунды', 'секунд']) : '...';

            days = ('0' + days).substr(-2);
            hours = ('0' + hours).substr(-2);
            minutes = ('0' + minutes).substr(-2);
            seconds = ('0' + seconds).substr(-2);

            const setContent = (id, value) => {
                this.childrenElements[id].innerHTML = this.dataInitialized ? value : '';
            };

            setContent('d_0_1', days[0]);
            setContent('d_0_2', days[1]);
            setContent('d_1_1', hours[0]);
            setContent('d_1_2', hours[1]);
            setContent('d_2_1', minutes[0]);
            setContent('d_2_2', minutes[1]);
            setContent('d_3_1', seconds[0]);
            setContent('d_3_2', seconds[1]);

            setContent('label_0', daysText);
            setContent('label_1', hoursText);
            setContent('label_2', minutesText);
            setContent('label_3', secondsLabel);

            if (timeLeft > 0 && APIState !== 0) {
                this.zeroInitialized = false;
            }

            return timeLeft;
        }

        tick () {
            const time_left = this.update();

            if (time_left > 0 || this.dataInitialized === false || APIState === 0) {
                setTimeout(() => {
                    this.tick();
                }, 500);
            } else {
                if ((this.reload || this.redirect) && this.zeroInitialized === false) {
                    if (this.reload) {
                        location.reload();
                    } else {
                        location.href = this.redirect;
                    }
                }
            }
        }
    }

    const initAllTimers = () => {
        const timerElements = doc.querySelectorAll('.' + Timer.className);
        for (let i = 0; i < timerElements.length; i++) {
            const init = timerElements[i].getAttribute('data-init');
            if (!init) {
                timers.push(new Timer(timerElements[i]));
            }
        }
        if (APIState !== 0) {
            setDataAll();
        }
    };
    initAllTimers();

    // экспортируем функцию для динамического создания таймеров
    win.abmTimerInitAll = initAllTimers;
})(window, document);
