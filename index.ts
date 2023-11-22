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
  load_images_as_array,
  make_alphabet_dataset,
  make_frame_dataset,
  romanize,
  setDPI,
} from "./helpers.js";
import { sequence_1 } from "./data.js";

// the ratio of the image (height / width)
const img_ratio = 0.78;

// type variables
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

let start, previous_time, canvas, ctx, images_loaded, frames_loaded;
let text = "";

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

const disturbance = {
  "1": 80,
  "2": 60,
  "3": 40,
  "4": 20,
  "5": 10,
  "6": 0,
};

// sets the current chapter, and starts the lines
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

// starts line of current chapter
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

// to start off
set_chapter("1");

// this holds the state of the chapter selection bar
const [next_chapter, set_next_chapter] = s(1);

// Main Div that has everything, including our Canvas
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
    frames_loaded = load_images_as_array(make_frame_dataset("shape", 60));

    // frames_loaded = [
    //   ...frames_loaded,
    //   ...load_images_as_array(make_frame_dataset("eye", 20)),
    // ];
    //
    // frames_loaded = frames_loaded.sort(() => 0.5 - Math.random());

    setTimeout(() => {
      requestAnimationFrame(canvas_loop);
    }, 100);
  });

  return h("canvas", { id: "canvas", width: 1200, height: 800 });
};

// the buttons that appear at the bottom of the screen
const ChapterSetter = () => {
  const chapters = m(() => {
    let chapters: number[] = [];

    for (let i = 1; i <= next_chapter(); i++) {
      chapters.push(i);
    }
    return chapters;
  });

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

let frame_index = 0;
let frame_beat = 0;

// The loop that runs the animation
// every frame, this function is called recursively
const canvas_loop = (timestamp) => {
  if (!start) start = timestamp;
  if (tl.resetting) {
    start = timestamp;
    tl.reset = 0;
    tl.resetting = false;
  }
  const elapsed = timestamp - start;

  tl.current_time = elapsed;

  if (frame_beat == 4) {
    if (frame_index >= 58) frame_index = 0;
    else frame_index++;
    draw_image_frame(frame_index);
    frame_beat = 0;
  } else {
    frame_beat++;
  }

  if (elapsed > tl.reset) {
    draw_stats();

    if (tl.typing) {
      ctx.globalCompositeOperation = "multiply";
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
    // ctx.fillStyle = "rgba(255,255,255,0.05)";
    // ctx.fillRect(0, 0, 1200, 800);
  }

  // variable_check();

  requestAnimationFrame(canvas_loop);
};

// increments the text index, if its the last letter,
// will unlock next chapter and stop the animations
const increment_index = () => {
  if (tl.text_index < text.length - 1) tl.text_index++;
  else {
    if (tl.typing) {
      set_next_chapter(parseInt(tl.chapter) + 1);
    }
    tl.typing = false;
  }
};

// Drawing of the stats
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

  ctx.fillText("chapter: ".toUpperCase() + tl.chapter, w - 100, 50);

  ctx.fillText("line: ".toUpperCase() + tl.line, w - 100, h - 50);
};

// draws the alphabet, the main type stuff
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

const draw_image_frame = (index) => {
  if (frames_loaded) {
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(
      frames_loaded[index],
      // Math.random() * 500 + 400, Math.random() * 500,
      0,
      100,
      3425 / 4,
      1662 / 4,
    );
  }
};

// resets the parameters of the type
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
