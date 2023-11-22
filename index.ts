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
import { load_images, make_alphabet_dataset, setDPI } from "./helpers.js";

const img_ratio = 0.78;

let type = {
  x_bound: 0,
  y_bound: 0,
  w_bound: 900,
  h_bound: 400,

  line: 1,
  line_at: 0,

  width: 100,
  height: function() {
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

let text = "apple mango banana";

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
        text: "hello this is something",
        start_time: 0,
        end_time: 2000,
      },

      "2": {
        text: "this should come after",
        start_time: 3000,
        end_time: 5000,
      },
    },
    audio: "audio/chapter2(act1).mp3",
    images: [],
  },
};

const set_chapter = (number) => {
  tl.chapter = number;
  tl.line = 1;

  let cur_audio = new Audio(sequence_1[tl.chapter].audio);

  tl.current_time = 0;
  tl.total_time = 0;
  tl.disturbance = 10;
  tl.text_index = 0;

  reset_type();
  start_lines();
  cur_audio.play();
};

const start_lines = () => {
  tl.text_index = 0;
  text = sequence_1[tl.chapter].lines[tl.line].text;
  tl.interval =
    (sequence_1[tl.chapter].lines[tl.line].end_time -
      sequence_1[tl.chapter].lines[tl.line].start_time) /
    text.length;
  tl.reset =
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

set_chapter("2");

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
  const elapsed = timestamp - start;

  tl.current_time = elapsed / 1000;

  if (elapsed > tl.reset) {
    ctx.globalCompositeOperation = "multiply";

    draw_stats();

    if (text[tl.text_index] !== " ")
      draw_alphabet(text[tl.text_index], tl.text_index + 3);
    tl.reset += tl.interval;
    increment_index();
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
  else tl.text_index = 0;
};

const draw_stats = () => {
  ctx.fillStyle = "black";
  ctx.font = "9px monospace";

  ctx.fillText(
    "disturbance: ".toUpperCase() + "+-" + Math.floor(tl.disturbance),
    10,
    60,
  );
  ctx.fillText(
    "current time: ".toUpperCase() + Math.floor(tl.current_time) + "s",
    10,
    50,
  );
};

const variable_check = () => {
  // if chapter is over, go next and reset stuff
  if (tl.current_time > 5) {
    tl.disturbance -= 150;
    if (tl.disturbance < 0) tl.disturbance = 0;
    tl.current_time = 0;
    start = 0;
    tl.text_index = 0;
    tl.reset = 500;
    reset_type();
    set_text(
      "what if this was a really long sentence longer than I can think of",
    );
  }
};

const draw_alphabet = (letter: string, index) => {
  if (images_loaded) {
    let x = type.x_bound + ((index - type.line_at) * type.width) / 2;

    if (x > type.w_bound) {
      console.log("new line");
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
    height: function() {
      return this.width * img_ratio;
    },
  };
}

reset_type();
render(Root, document.querySelector(".root"));
