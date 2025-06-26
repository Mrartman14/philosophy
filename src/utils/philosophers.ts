export type Timeline = {
  name: string;
  from: number;
  to: number;
  imageSrc?: string;
};
export const philosophers: Timeline[] = [
  {
    name: "Пифагор",
    from: -570,
    to: -490,
    imageSrc: "/philosophers/pythagoras.jpg",
  },
  {
    name: "Парменид",
    from: -540,
    to: -470,
    imageSrc: "/philosophers/parmenides.jpg",
  },
  {
    name: "Гераклит",
    from: -544,
    to: -483,
    imageSrc: "/philosophers/heraclitus.jpg",
  },
  {
    name: "Зенон",
    from: -490,
    to: -425,
    imageSrc: "/philosophers/zenon.jpg",
  },
  {
    name: "Платон",
    from: -427,
    to: -347,
    imageSrc: "/philosophers/plato.jpg",
  },
  {
    name: "Аристотель",
    from: -384,
    to: -322,
    imageSrc: "/philosophers/aristotle.jpg",
  },
  {
    name: "Эпикур",
    from: -341,
    to: -270,
    imageSrc: "/philosophers/epicurus.jpg",
  },
  {
    name: "Сократ",
    from: -469,
    to: -399,
    imageSrc: "/philosophers/socrates.jpg",
  },
];
