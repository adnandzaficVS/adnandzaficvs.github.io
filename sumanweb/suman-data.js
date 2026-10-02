window.SUMAN = {
  EUR: 1.95583,
  B2B_DISCOUNT: 0.18,
  models: [
    { id: 'beach', name: 'Beach', seg: 'home', from: 185, img: 'https://wsrv.nl/?w=1600&q=74&output=webp&url=suman.ba/assets/photos/products/original/1557471741-beach.jpg' },
    { id: 'advance', name: 'Advance', seg: 'both', from: 420, best: true, img: 'https://wsrv.nl/?w=1600&q=74&output=webp&url=suman.ba/assets/photos/products/original/1557424992-advance.jpg' },
    { id: 'prestige', name: 'Prestige', seg: 'pro', from: 1150, img: 'https://wsrv.nl/?w=1600&q=74&output=webp&url=suman.ba/assets/photos/products/original/1557416077-prestige.jpg' },
    { id: 'magnum', name: 'Magnum', seg: 'pro', from: 1890, img: 'https://wsrv.nl/?w=1600&q=74&output=webp&url=suman.ba/assets/photos/products/original/1557425199-magnum.jpg' },
    { id: 'console', name: 'Console', seg: 'pro', from: 2450, img: 'https://wsrv.nl/?w=1600&q=74&output=webp&url=suman.ba/assets/photos/gallery/original/11-konzolni-suncobran-job-13-1557425292.jpg' }
  ],
  gallery: [
    'https://wsrv.nl/?w=1600&q=74&output=webp&url=suman.ba/assets/photos/products/original/1557424992-advance.jpg',
    'https://wsrv.nl/?w=1600&q=74&output=webp&url=suman.ba/assets/photos/gallery/original/1-suman-suncobran-advance-1-1700829309.jpg',
    'https://wsrv.nl/?w=1600&q=74&output=webp&url=suman.ba/assets/photos/gallery/original/1-suman-suncobran-advance-2-1700829502.jpg',
    'https://wsrv.nl/?w=1600&q=74&output=webp&url=suman.ba/assets/photos/gallery/original/1-suman-suncobran-advance-6-1700829502.jpg',
    'https://wsrv.nl/?w=1600&q=74&output=webp&url=suman.ba/assets/photos/gallery/original/1-suman-suncobran-advance-9-1700829502.jpg',
    'https://wsrv.nl/?w=1600&q=74&output=webp&url=suman.ba/assets/photos/gallery/original/1-suman-suncobran-advance-5-1700829502.jpg'
  ],
  sizes: {
    classic: { LS: ['200', '250', '300', '350', '400'], LO: ['200', '250', '300', '350', '400'], LR: ['3022', '3526', '4030'] },
    tele: { LS: ['300', '350', '400'], LO: ['300', '350', '400', '500'], LR: ['3022', '3526', '4030'] }
  },
  sizeLabel: { LS: (s) => s + '×' + s + ' cm', LO: (s) => 'Ø ' + s + ' cm', LR: (s) => s.slice(0, 2) + '0×' + s.slice(2) + '0 cm' },
  basePrice: { LS200: 420, LS250: 520, LS300: 640, LS350: 790, LS400: 960, LO200: 400, LO250: 495, LO300: 610, LO350: 750, LO400: 910, LO500: 1180, LR3022: 600, LR3526: 760, LR4030: 900 },
  specs: {
    classic: { LS200: [248, 6.25, '25×25×270'], LS250: [260, 10.5, '25×25×270'], LS300: [275, 12.35, '25×25×290'], LS350: [290, 13.5, '25×25×305'], LS400: [320, 14.5, '25×25×310'], LO200: [248, 6, '25×25×270'], LO250: [260, 8, '25×25×270'], LO300: [275, 11.25, '25×25×290'], LO350: [290, 12.65, '25×25×310'], LO400: [290, 13, '25×25×310'], LR3022: [275, 12.25, '25×25×290'], LR3526: [275, 13.15, '25×25×295'], LR4030: [290, 14.5, '25×25×305'] },
    tele: { LS300: [272, 13.45, '25×25×340'], LS350: [293, 17.25, '25×25×370'], LS400: [297, 23.5, '25×25×440'], LO300: [275, 12, '25×25×340'], LO350: [282, 13, '25×25×340'], LO400: [293, 13.6, '25×25×340'], LO500: [320, 14.5, '25×25×370'], LR3022: [270, 14, '25×25×340'], LR3526: [279, 15, '25×25×340'], LR4030: [293, 16.15, '25×25×370'] }
  },
  mech: [{ id: 'CR', add: 0 }, { id: 'CS', add: -20 }, { id: 'T3', add: 190 }],
  frames: [{ id: 'white', hex: '#EEEDE7', add: 0 }, { id: 'anth', hex: '#383E42', add: 60 }, { id: 'wood', hex: '#8B5E3C', add: 120 }],
  looks: [{ id: 'std', add: 0 }, { id: 'cascade', add: 90 }],
  vents: [{ id: 'none', add: 0 }, { id: 'L', add: 25 }, { id: 'KL', add: 45 }, { id: 'C2', add: 70 }],
  fabrics: [
    { id: '220', pct: 0, colors: [['123C', '#FFC72C'], ['185C', '#E4002B'], ['202C', '#862633'], ['286C', '#0033A0'], ['3425C', '#006341'], ['348C', '#00843D'], ['7501C', '#D9C89E'], ['BLACK', '#2D2926'], ['COOL GRAY 10C', '#63666A'], ['WARM GRAY 3C', '#BFB8AF'], ['WHITE', '#F4F4F1']] },
    { id: '300', pct: 0.12, colors: [['123C', '#FFC72C'], ['202C', '#862633'], ['286C', '#0033A0'], ['3435C', '#154734'], ['7501C', '#D9C89E'], ['BLACK', '#2D2926'], ['COOL GRAY 10C', '#63666A'], ['WHITE', '#F4F4F1']] }
  ],
  brands: [
    { id: 'none', name: '', canopy: null },
    { id: 'cocacola', logo: 'brands/cocacola.png', name: 'Coca-Cola', canopy: '#E4002B', text: 'Coca-Cola' },
    { id: 'lasko', logo: 'brands/lasko.png', name: 'Laško', canopy: '#006341', text: 'LAŠKO' },
    { id: 'karlovacko', logo: 'brands/karlovacko.png', name: 'Karlovačko', canopy: '#E4002B', text: 'KARLOVAČKO' },
    { id: 'ozujsko', logo: 'brands/ozujsko.png', name: 'Ožujsko', canopy: '#862633', text: 'OŽUJSKO' },
    { id: 'sarajevsko', logo: 'brands/sarajevsko.png', name: 'Sarajevsko', canopy: '#154734', text: 'SARAJEVSKO' },
    { id: 'heineken', logo: 'brands/heineken.png', name: 'Heineken', canopy: '#00843D', text: 'Heineken' }
  ],
  brandAdd: 140,
  bases: [{ id: 'none', add: 0 }, { id: 'concrete', add: 95 }, { id: 'm854', add: 185 }, { id: 'm860', add: 210 }, { id: 'fold880', add: 160 }, { id: 'embed', add: 45 }],
  partner: { company: 'Adria Ugostiteljstvo d.o.o.', city: 'Tuzla', contact: 'Amra Hodžić', manager: 'Emir Suljić', managerPhone: '+387 35 700 120', managerMail: 'emir.suljic@suman.ba' },
  orders: [
    { no: 'SU-26-0418', date: '22.09.2026.', eta: '14.10.2026.', stage: 1, value: 7420, ref: 'Terasa Kapija', addr: 'Trg slobode 4, Tuzla', dates: ['22.09.', '25.09.', '', '', ''],
      items: [{ q: 6, n: 'Advance LS 350 T3', d: 'Bijela RAL 9016 · Poliester 300 · 286C · Coca-Cola' }, { q: 6, n: 'Postolje metalno 860×860', d: 'Ø58' }] },
    { no: 'SU-26-0402', date: '09.09.2026.', eta: '30.09.2026.', stage: 2, value: 3180, ref: 'Hotel Tuzla – bazen', addr: 'Mihajla i Živka Crnogorčevića 4, Tuzla', dates: ['09.09.', '11.09.', '29.09.', '', ''],
      items: [{ q: 4, n: 'Advance LO 300 CR', d: 'Imitacija drveta · Poliester 220 · 7501C' }, { q: 4, n: 'Postolje betonsko Ø600', d: 'Ø58' }] },
    { no: 'SU-26-0371', date: '18.08.2026.', eta: '08.09.2026.', stage: 3, value: 11960, ref: 'Caffe Galerija', addr: 'Turalibegova 12, Tuzla', dates: ['18.08.', '20.08.', '04.09.', '08.09.', ''],
      items: [{ q: 8, n: 'Advance LS 400 T3', d: 'Antracit RAL 7016 · Cascade look® · Laško' }, { q: 8, n: 'Postolje za ubetoniranje', d: 'Ø58' }] },
    { no: 'SU-26-0322', date: '02.07.2026.', eta: '24.07.2026.', stage: 4, value: 2240, ref: 'Restoran Panonika', addr: 'Panonska jezera bb, Tuzla', dates: ['02.07.', '03.07.', '19.07.', '22.07.', '24.07.'],
      items: [{ q: 3, n: 'Advance LR 4030 CR', d: 'Bijela RAL 9016 · Poliester 220 · WHITE' }] },
    { no: 'SU-26-0299', date: '11.06.2026.', eta: '—', stage: 0, value: 1560, ref: 'Dopuna – rezervna platna', addr: 'Trg slobode 4, Tuzla', dates: ['29.09.', '', '', '', ''],
      items: [{ q: 4, n: 'Platno Advance LS 300', d: 'Poliester 220 · 185C · Karlovačko' }] }
  ]
};
