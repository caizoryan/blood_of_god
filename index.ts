import {
  For,
  Match,
  Switch,
  createEffect as e,
  createMemo as m,
  createSignal as s,
  on,
  onMount,
  Show,
} from "./solid/solid.js";
import { render } from "./solid/web/web.js";
import h from "./solid/h/h.js";
import {
  load_images,
  make_alphabet_dataset,
  romanize,
  setDPI,
} from "./helpers.js";

const img_ratio = 0.78;

let type = {
  x_bound: 0,
  y_bound: 0,
  w_bound: 900,
  h_bound: 400,

  line: 1,
  line_at: 0,

  width: 100,
  height: function () {
    return this.width * img_ratio;
  },
};

type line_data = {
  text: string;
  start_time: number;
  end_time: number;
  duration: () => number;
};

type chapter = { lines: line_data[]; images: string[]; audio: string };

let start, previous_time, canvas, ctx, images_loaded;

let tl: any = {};
tl.current_time = 0;
tl.total_time = 0;
tl.chapter = 1;
tl.act = 1;
tl.sequence = 1;
tl.disturbance = 50;
tl.interval = 50;
tl.reset = 50;
tl.text_index = 0;
tl.typing = false;
tl.resetting = false;

let text = "";

const sequence_1 = {
  "1": {
    lines: {
      "1": {
        text: "I cannot help but look in the mirror and wonder If the blood of a God might save me",
        start_time: 0,
        end_time: 5000,
      },
    },
    audio: "audio/chapter1(act1).mp3",
    images: [],
  },

  "2": {
    lines: {
      "1": {
        text: "Make my body as its meant to be",
        start_time: 0,
        end_time: 2800,
      },

      "2": {
        text: "Flesh twisting and weaving under skin",
        start_time: 2870,
        end_time: 6000,
      },
      "3": {
        text: "Animation of the body The truest image of what that God made",
        start_time: 6000,
        end_time: 11000,
      },
    },
    audio: "audio/chapter2(act1).mp3",
    images: [],
  },

  "3": {
    lines: {
      "1": {
        text: " A deity sacrificed to make its creation sing",
        start_time: 0,
        end_time: 3600,
      },
    },
    audio: "audio/chapter3(act1).mp3",
    images: [],
  },

  "4": {
    lines: {
      "1": {
        text: "Not left unfinished Like a lackluster thesis I am a project worth finishing Even if reality is a medium that cannot hold me",
        start_time: 0,
        end_time: 8550,
      },
    },
    audio: "audio/chapter4(act2).mp3",
    images: [],
  },

  "5": {
    lines: {
      "1": {
        text: "How cruel To pin a moving image down to canvas",
        start_time: 0,
        end_time: 3500,
      },

      "2": {
        text: "Tell it to be happy with only half itself",
        start_time: 4300,
        end_time: 7000,
      },
    },
    audio: "audio/chapter5(act3).mp3",
    images: [],
  },

  "6": {
    lines: {
      "1": {
        text: "Sometimes",
        start_time: 0,
        end_time: 1500,
      },

      "2": {
        text: "In the moment just before I close my eyes I can see them",
        start_time: 1800,
        end_time: 5600,
      },

      "3": {
        text: "The rest of me",
        start_time: 6000,
        end_time: 7000,
      },
      "4": {
        text: "The before and after image",
        start_time: 7700,
        end_time: 10000,
      },

      "5": {
        text: "The parts of me forgotten in the still shot The pieces that make me a",
        start_time: 10000,
        end_time: 14000,
      },
      "6": {
        text: "complete idea",
        start_time: 14000,
        end_time: 17000,
      },
    },
    audio: "audio/chapter6(act3).mp3",
    images: [],
  },
};

const disturbance = {
  "1": 80,
  "2": 60,
  "3": 40,
  "4": 20,
  "5": 10,
  "6": 0,
};

const get_last_line_of_current_chapter = () => {
  let current_chapter = sequence_1[tl.chapter];
  current_chapter[
    Object.keys(current_chapter)[Object.keys(current_chapter).length - 1]
  ];
};

const set_chapter = (number) => {
  tl.chapter = number;
  tl.line = 1;
  tl.resetting = true;

  let cur_audio = new Audio(sequence_1[tl.chapter].audio);

  tl.disturbance = disturbance[tl.chapter];
  tl.text_index = 0;

  reset_type();
  start_lines();
  cur_audio.play();
};

const start_lines = () => {
  tl.typing = true;
  tl.text_index = 0;
  text = sequence_1[tl.chapter].lines[tl.line].text;
  tl.interval =
    (sequence_1[tl.chapter].lines[tl.line].end_time -
      sequence_1[tl.chapter].lines[tl.line].start_time) /
    text.length;

  reset_type();

  if (tl.line === 1) {
    for (const [key, value] of Object.entries(sequence_1[tl.chapter].lines)) {
      if (key !== "1") {
        setTimeout(() => {
          tl.line++;
          start_lines();
        }, value.start_time);
      }
    }
  }
};

set_chapter("1");

const [next_chapter, set_next_chapter] = s(1);

const ChapterSetter = () => {
  const chapters = m(() => {
    let chapters: number[] = [];

    for (let i = 1; i <= next_chapter(); i++) {
      chapters.push(i);
    }
    return chapters;
  });

  console.log(chapters());

  return h(
    "div",
    {
      style: {
        position: "absolute",
        bottom: "10px",
        left: "0px",
        width: "100%",
        height: "50px",
        display: "flex",
        "justify-content": "center",
      },
    },

    () =>
      For({
        each: chapters(),
        children: (chapter) =>
          h(
            "button",
            {
              style: {
                "margin-right": "30px",
              },
              onclick: () => {
                set_chapter(chapter);
              },
            },
            romanize(parseInt(chapter)),
          ),
      }),
  );
};

const Root = () => {
  return h(
    "div",
    {
      style: {
        display: "flex",
        "justify-content": "center",
        "align-items": "center",
        height: "100vh",
      },
    },
    Frame,
    ChapterSetter,
  );
};

// ----------------
// This is the canvas
const Frame = () => {
  onMount(() => {
    canvas = document.getElementById("canvas") as HTMLCanvasElement;
    ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    setDPI(canvas, 300);
    images_loaded = load_images(make_alphabet_dataset());

    setTimeout(() => {
      requestAnimationFrame(canvas_loop);
    }, 100);
  });

  return h("canvas", { id: "canvas", width: 1200, height: 800 });
};

const canvas_loop = (timestamp) => {
  if (!start) start = timestamp;
  if (tl.resetting) {
    start = timestamp;
    tl.reset = 0;
    tl.resetting = false;
  }
  const elapsed = timestamp - start;

  tl.current_time = elapsed;

  if (elapsed > tl.reset) {
    ctx.globalCompositeOperation = "multiply";

    draw_stats();

    if (tl.typing) {
      if (text[tl.text_index] !== " ")
        draw_alphabet(text[tl.text_index], tl.text_index + 3);
      tl.reset += tl.interval;
      increment_index();
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(255,255,255,0.01)";
      ctx.fillRect(0, 0, 1200, 800);
    }
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(0, 0, 1200, 800);
  }

  // variable_check();

  requestAnimationFrame(canvas_loop);
};

const increment_index = () => {
  if (tl.text_index < text.length - 1) tl.text_index++;
  else {
    if (tl.typing) {
      set_next_chapter(parseInt(tl.chapter) + 1);
    }
    tl.typing = false;
  }
};

const draw_stats = () => {
  ctx.fillStyle = "black";
  ctx.font = "9px monospace";

  let s = 300 / 96;

  let w = parseInt(canvas.width) / s;
  let h = parseInt(canvas.height) / s;

  console.log(w, h);

  ctx.fillText(
    "current time: ".toUpperCase() + Math.floor(tl.current_time) + "s",
    10,
    50,
  );

  ctx.fillText(
    "disturbance: ".toUpperCase() + "+-" + Math.floor(tl.disturbance),
    10,
    h - 50,
  );

  ctx.fillText("chapter: ".toUpperCase() + tl.chapter, w - 50, 50);

  ctx.fillText("line: ".toUpperCase() + tl.line, w - 50, h - 50);
};

const draw_alphabet = (letter: string, index) => {
  if (images_loaded) {
    let x = type.x_bound + ((index - type.line_at) * type.width) / 2;

    if (x > type.w_bound) {
      type.line++;
      type.line_at = index - 1;
      x = type.x_bound;
    }

    let y = type.y_bound + type.line * type.height();
    let hr = Math.random() * tl.disturbance;
    if (Math.random() > 0.5) hr *= -1;
    let wr = hr;
    if (wr + x > type.x_bound) wr = 0;

    ctx.drawImage(
      images_loaded[letter],
      x + wr,
      y + hr,
      type.width,
      type.height(),
    );
  }
};

function reset_type() {
  type = {
    x_bound: 100,
    y_bound: 300,
    w_bound: 700,
    h_bound: 400,

    line: 1,
    line_at: 0,

    width: 50,
    height: function () {
      return this.width * img_ratio;
    },
  };
}

reset_type();
render(Root, document.querySelector(".root"));
