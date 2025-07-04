"use client";

import { useState } from "react";

// import { ExamConfig } from "@/utils/exams-config";
import { Radio } from "@base-ui-components/react/radio";
import { RadioGroup } from "@base-ui-components/react/radio-group";

type ExamRule = {
  title: string;
  order: number;
  sources: string[];
  answer: string;
  isSuggestionCorrect?: boolean;
};

interface ExamViewerProps {
  // config: ExamConfig;
  className: string;
}
export const ExamViewer: React.FC<ExamViewerProps> = ({
  // config,
  className,
}) => {
  const [data, setData] = useState<ExamRule[]>([
    {
      title: "Отгадайте философскую идею по картинке",
      order: 1,
      sources: ["/exams/exam-1/pics/task-1.jpeg"],
      answer:
        "Логический парадокс осмысления каппадокийцами бога через фрактальную структуру включения его общего (усии) в частное (юпостасиса) и включения частного в общее. На картинке Гарри Поттер смотрит на карту мародёров, на которой видит себя, смотрящего на карту мародёров и тп.",
    },
    {
      title: "Отгадайте две философские идеи по двум картинкам",
      order: 2,
      sources: [
        "/exams/exam-1/pics/task-2-1.jpeg",
        "/exams/exam-1/pics/task-2-2.jpeg",
      ],
      answer:
        "На обеих картинках изображены три публичных образа Бэтмена — подлинная сущность Брюса Уэйна, справедливый супергерой для жителей Готема и легкомысленный бизнесмен для прессы. На первой картинке туманом окутаны тела и видны только лица — юпостасисы, что демонстрирует примат личности над сущностью; правильный ответ — восточное богословие. На второй картинке четко изображена подлинная сущность Брюса Уейна, а в тумане находятся два его образа, что демонстрирует примат сущности над личностью. Ответ — западное богословие.",
    },
    {
      title: "Отгадайте философа или его идею по картинке",
      order: 3,
      sources: ["/exams/exam-1/pics/task-3.jpeg"],
      answer:
        "Эпикур и его Тетрафармакон. Слева направо воплощения каждого тезиса: 1) «Богов» бояться не надо 2) Смерти бояться не надо 3) Страдание легко перенести 4) Благо легко достижимо",
    },
    {
      title: "Отгадайте философа по картинке",
      order: 4,
      sources: ["/exams/exam-1/pics/task-4.jpeg"],
      answer:
        "Пузырь как непознаваемая протяжённая субстанция удерживает первичные качества — число (шар с цифрой), движение (птица), форма (куб) и протяженность (зелёное вещество). Правильный ответ — Джон Локк.",
    },
    {
      title: "Отгадайте философа по картинке",
      order: 5,
      sources: ["/exams/exam-1/pics/task-5.jpeg"],
      answer:
        "Пузырь как протяжённая субстанция пропадает — остаются только качества и тот, кто их воспринимает, то есть мыслящая субстанция. Помимо первого воспринимаеющего появляется главный наблюдатель (человек в экране) — бог, в восприятии которого находится весь мир. Ответ — Джордж Беркли.",
    },
    {
      title: "Отгадайте философа по картинке",
      order: 6,
      sources: ["/exams/exam-1/pics/task-6.jpeg"],
      answer:
        "Дэвид Юм. Исчезает любая субстанция (Нео теперь тоже симуляция, главного наблюдателя нет), остаётся только поле восприятия (эмпирический опыт).",
    },
    {
      title: "Отгадайте философа по картинке",
      order: 7,
      sources: [
        "/exams/exam-1/pics/task-7-1.jpeg",
        "/exams/exam-1/pics/task-7-2.jpeg",
      ],
      answer:
        "Рене Декарт. На первой картинке изображён человек, с помощью рассуждений (формул) выводящий факт собственного существования. На второй картинке изображён человек, стоящий на разделе (посередине дороги) между мыслящей субстранцией (формулы на фасадах домов) и протяженной субстранцией (протяжённая стена).",
    },
    {
      title: "Отгадайте философа или его идею по картинке",
      order: 8,
      sources: ["/exams/exam-1/pics/task-8.jpeg"],
      answer:
        "Марк Аврелий и отказ от прошлых и будущих переживаний для достижения атараксии.",
    },
    {
      title: "Отгадайте философа или его идею по картинке",
      order: 9,
      sources: ["/exams/exam-1/pics/task-9.jpeg"],
      answer:
        "Джордж Беркли и его идея esse est percipi (быть = быть воспринимаемым).",
    },
    {
      title: "Отгадайте философа или его идею по двум картинкам",
      order: 10,
      sources: [
        "/exams/exam-1/pics/task-10-1.jpeg",
        "/exams/exam-1/pics/task-10-2.jpeg",
      ],
      answer:
        "Христианская эклесия и достижение сжатого времени. Первая картинка — человек стремится вести себя так, как будто он уже находится в будущем, к достижению которого он стремится (спираль времени ведущая к Граду Божьему). На второй картинке происходит разрыв линейного времени — то, чего люди добиваются, приходя в церковь.",
    },
    {
      title: "Отгадайте философскую идею по картинке",
      order: 11,
      sources: ["/exams/exam-1/pics/task-11.jpeg"],
      answer:
        "Краш-тест — философствующий человек испытывает на прочность картину реальности.",
    },
    {
      title: "Отгадайте философа по картинке",
      order: 12,
      sources: ["/exams/exam-1/pics/task-12.jpeg"],
      answer:
        "Сократ. Спуск по лестнице символизирует поиск предельного основания через метод майевтики.",
    },
  ]);

  // useEffect(() => {
  //   async function getJSON() {
  //     const res = await fetch(config.sources[0].path);
  //     const nextJson = await res.json();
  //     setData(nextJson);
  //   }

  //   getJSON();
  // }, [config.sources]);

  const handleVote = (order: number) => (b: boolean) =>
    setData((prev) =>
      prev.map((x) => {
        if (x.order === order) {
          return { ...x, isSuggestionCorrect: b };
        } else {
          return x;
        }
      })
    );

  const voted = data.filter((x) => typeof x.isSuggestionCorrect === "boolean");
  const correctVoted = voted.filter((x) => x.isSuggestionCorrect);
  return (
    <div className={`prose dark:prose-invert lg:prose-xl px-4 ${className}`}>
      {data.map((rule) => (
        <RuleView
          key={rule.order}
          rule={rule}
          onVote={handleVote(rule.order)}
        />
      ))}
      {voted.length === data.length && (
        <>
          <p className="text-lg md:text-3xl" style={{ textAlign: "right" }}>
            Итоговый результат: {correctVoted.length} / {data.length}
          </p>
          <p className="pb-2">
            Ваши интерпретации картинок могут оказаться столь же правильными,
            что и закладываемые авторами.
          </p>
        </>
      )}
    </div>
  );
};

const RuleView: React.FC<{ rule: ExamRule; onVote: (b: boolean) => void }> = ({
  rule,
  onVote,
}) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);

  return (
    <div>
      <h3>
        {rule.order}. {rule.title}
      </h3>
      <div>
        <div
          className={`grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fill,_minmax(400px,_1fr))]`}
        >
          {rule.sources.map((source) => (
            <img
              alt="Task image"
              key={source}
              src={`${basePath}${source}`}
              style={{ margin: 0 }}
            />
          ))}
        </div>

        <p>
          <span className="font-semibold text-(--description)">Ответ: </span>
          <span
            role="switch"
            aria-checked={isAnswerRevealed}
            onClick={() => setIsAnswerRevealed((prev) => !prev)}
            className={`spoiler ${isAnswerRevealed ? "revealed" : ""}`}
          >
            {isAnswerRevealed
              ? rule.answer
              : rule.answer.replace(/[^\s]/g, "?")}
          </span>
        </p>

        <RadioGroup
          onValueChange={(x) => onVote(x as boolean)}
          aria-labelledby={`${rule.title}`}
          className={`flex flex-col items-start gap-1 ${
            isAnswerRevealed ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className="font-semibold text-(--description)"
            id={`${rule.title}`}
          >
            Совпал ли ваш ответ?
          </div>

          {[
            { name: "Да", value: true },
            { name: "Нет", value: false },
          ].map((opt) => (
            <label key={opt.name} className="flex items-center gap-2">
              <Radio.Root
                value={opt.value}
                className="flex size-5 items-center justify-center rounded-full data-[checked]:bg-(--border) data-[unchecked]:border data-[unchecked]:border-(--border)"
              >
                <Radio.Indicator className="flex before:size-2 before:rounded-full before:bg-(--primary) data-[unchecked]:hidden" />
              </Radio.Root>
              {opt.name}
            </label>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
};
