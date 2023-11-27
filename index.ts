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
  current_image_set,
  current_total_duration,
  load_images,
  load_images_as_array,
  make_alphabet_dataset,
  make_frame_dataset,
  next_image_set,
  romanize,
  setDPI,
} from "./helpers.js";
import { sequence_1 } from "./data.js";

// the ratio of the image (height / width)
const img_ratio = 0.78;

const [mouse, set_mouse] = s({ x: 0, y: 0 });

// type variables
let type = {
  x_bound: 0,
  y_bound: 0,
  w_bound: 900,
  h_bound: 1200,

  line: 1,
  last_line_end: 0,

  width: 500,
  height: function () {
    return this.width * img_ratio;
  },
};

let other_img_ratio = 0.501;

let image = {
  w: 200,
  h: function () {
    return this.w * other_img_ratio;
  },
  x: 300,
  y: 300,
  w_bound: 200,
  h_bound: 400,
  spatial_randomness: 500,
  temporal_randomness: 0.9,
  size_random_max: 500,
  size_random_min: 200,
};

e(() => {
  type.y_bound = mouse().y - type.line * 50;
  type.x_bound = mouse().x > 100 ? 100 : mouse().x;
});

let start, canvas, ctx;
let text = "";

let img_db: any = {};

export let tl: any = {
  chapter: 1,
  act: 1,
  sequence: 1,
  image_set: 0,
  image_index: 0,
  disturbance: 250,
  text_index: 0,
  typing: false,
  resetting: false,
  elapsed: 0,
};

let timer = {
  type: {
    interval: 50,
    next_draw: 50,
  },
  image: {
    interval: 40.1,
    next_draw: 200,
  },
  reset: function () {
    this.type.next_draw = 0;
    this.image.next_draw = 0;
  },
};

const disturbance = {
  "1": 280,
  "2": 200,
  "3": 140,
  "4": 80,
  "5": 10,
  "6": 0,
};

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

    canvas.addEventListener("mousemove", (e) => {
      set_mouse({ x: e.clientX, y: e.clientY });
    });

    setDPI(canvas, 300);
    img_db.type = load_images(make_alphabet_dataset());

    for (const value of Object.values(sequence_1)) {
      value.images.forEach((image) => {
        img_db[image.name] = load_images_as_array(
          make_frame_dataset(image.name, image.frames),
        );

        console.log(img_db);
      });
    }
    // to start off
    set_chapter("3");

    setTimeout(() => {
      requestAnimationFrame(canvas_loop);
    }, 100);
  });

  return h("canvas", {
    id: "canvas",
    width: window.innerWidth,
    height: window.innerHeight,
  });
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

const increment_image_index = () => {
  if (tl.image_index >= current_image_set().frames - 1) {
    if (next_image_set()) {
      tl.image_set++;
    } else {
      tl.image_set = 0;
    }
    tl.image_index = 0;
  } else tl.image_index++;
};

const scheduler = {
  draw_type: function () {
    if (tl.typing) {
      ctx.globalCompositeOperation = "multiply";
      if (text[tl.text_index] !== " ")
        draw_alphabet(text[tl.text_index], tl.text_index + 3);
      tick.call(timer.type);
      increment_index();
    }
  },
  draw_image: function () {
    if (!current_image_set()) return;

    increment_image_index();
    draw_image_frame(tl.image_index);
    tick.call(timer.image);
  },
  draw_stats: function () {
    draw_stats();
  },
  play: function () {
    scheduler.draw_stats();
    is_time.call(timer.type) ? scheduler.draw_type() : null;
    is_time.call(timer.image) ? scheduler.draw_image() : null;
    if (Math.random() < 0.03) not_clear();
  },
};

const clock = {
  tick: function (timestamp) {
    if (!start) start = timestamp;
    if (tl.resetting) this.reset(timestamp);
    tl.elapsed = timestamp - start;
  },

  reset: function (timestamp) {
    start = timestamp;
    timer.reset();
    tl.resetting = false;
  },
};

function is_time() {
  return tl.elapsed > this.next_draw;
}

// The loop that runs the animation
// every frame, this function is called recursively
const canvas_loop = (timestamp) => {
  clock.tick(timestamp);
  scheduler.play();
  requestAnimationFrame(canvas_loop);
};

// ---------------
// Drawing Procedures
// ---------------

// clears the canvas, but not completely... actually barely
const not_clear = () => {
  let x_disturbance = Math.random() * image.spatial_randomness * pos_or_neg();
  let y_distrubance = Math.random() * image.spatial_randomness * pos_or_neg();

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.fillRect(0, 0, 1200, 800);
};

// Drawing of the stats
const draw_stats = () => {
  ctx.fillStyle = "black";
  ctx.font = "9px monospace";

  let s = 300 / 96;

  let w = parseInt(canvas.width) / s;
  let h = parseInt(canvas.height) / s;

  // top left
  ctx.fillText(
    "current time: ".toUpperCase() + Math.floor(tl.elapsed / 1000) + "s",
    10,
    50,
  );

  ctx.fillText("image size: ".toUpperCase() + image.w + "px", 10, 60);
  ctx.fillText(
    "image spatial randomness: ".toUpperCase() +
      image.spatial_randomness +
      "px",
    10,
    70,
  );
  ctx.fillText(
    "image temporal randomness: ".toUpperCase() +
      image.temporal_randomness +
      "%",
    10,
    80,
  );

  ctx.fillText("image max: ".toUpperCase() + image.w_bound + "px", 10, 90);

  // top right
  ctx.fillText(
    "disturbance: ".toUpperCase() + "+-" + Math.floor(tl.disturbance),
    10,
    h - 50,
  );

  // bottom left
  ctx.fillText("chapter: ".toUpperCase() + tl.chapter, w - 100, 50);

  // bottom right
  ctx.fillText("line: ".toUpperCase() + tl.line, w - 100, h - 50);
};

// draws the alphabet, the main type stuff
const draw_alphabet = (letter: string, index) => {
  if (img_db.type) {
    let x = type.x_bound + ((index - type.last_line_end) * type.width) / 2;

    if (x > type.w_bound) {
      type.line++;
      type.last_line_end = index - 1;
      x = type.x_bound;
    }

    let y = type.y_bound;
    // + type.line * type.height();
    let hr = Math.random() * tl.disturbance * pos_or_neg();
    let wr = Math.random() * tl.disturbance * pos_or_neg();

    y += hr;
    x += wr;

    if (y > type.h_bound) {
      y = type.y_bound - Math.random() * image.spatial_randomness;
    }

    if (x > type.w_bound) {
      x = type.x_bound - Math.random() * image.spatial_randomness;
    }

    ctx.drawImage(img_db.type[letter], x, y, type.width, type.height());
  }
};

const pos_or_neg = () => (Math.random() > 0.5 ? 1 : -1);

const draw_image_frame = (index) => {
  // skip
  if (Math.random() < image.temporal_randomness) return;
  if (current_image_set()) {
    // if (mouse().x > 300) ctx.globalCompositeOperation = "source-over";
    // if (mouse().x > 600) ctx.globalCompositeOperation = "soft-light";
    // if (mouse().x > 700) ctx.globalCompositeOperation = "exclusion";
    // if (mouse().x > 900) ctx.globalCompositeOperation = "lighten";
    // if (mouse().x > 1000) ctx.globalCompositeOperation = "difference";
    //
    // timer.image.interval = (mouse().y / 1000) * 100;

    let x_disturbance = Math.random() * image.spatial_randomness * pos_or_neg();
    let y_distrubance = Math.random() * image.spatial_randomness * pos_or_neg();

    let x = image.x + x_disturbance;
    let y = image.y + y_distrubance;

    ctx.globalCompositeOperation = "source-over";

    image.w = Math.floor(
      Math.random() * (image.size_random_max - image.size_random_min) +
        image.size_random_min,
    );

    let w = image.w;
    let h = image.h();

    // ctx.globalCompositeOperation = "exclusion";
    ctx.drawImage(img_db[current_image_set().name][index], x, y, w, h);
  }
};

// ----------------
// State Manipulators
// or Procedures
// ----------------

// also a procedure
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

// also a procedure
// starts line of current chapter
const start_lines = () => {
  tl.typing = true;
  tl.text_index = 0;
  text = sequence_1[tl.chapter].lines[tl.line].text;
  timer.type.interval =
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

// resets the parameters of the type
function reset_type() {
  type = {
    x_bound: 0,
    y_bound: 500,
    w_bound: 900,
    h_bound: 1200,

    line: 1,
    last_line_end: 0,

    width: 150,
    height: function () {
      return this.width * img_ratio;
    },
  };
}

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

function tick() {
  this.next_draw += this.interval;
}

reset_type();
render(Root, document.querySelector(".root"));
