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
  current_chapter,
  current_image_set,
  current_total_duration,
  load_all_images,
  load_images,
  load_images_as_array,
  make_alphabet_dataset,
  make_frame_dataset,
  next_image_set,
  romanize,
  setDPI,
} from "./helpers.js";
import { sequence_1 } from "./data.js";
import { current_climate } from "./climate";

let loops = 0;
let audio_played = 0;

// the ratio of the image (height / width)
//
// for white alophebet
// export const img_ratio = 0.78;
export const img_ratio = 1.27;

const [mouse, set_mouse] = s({ x: 0, y: 0 });

// type variables
export let type = {
  x_bound: 0,
  y_bound: 0,
  w_bound: 900,
  h_bound: 1200,

  line: 1,
  last_line_end: 0,
  disturbance: 250,

  width: 400,
  height: function() {
    return this.width * img_ratio;
  },
};

export let other_img_ratio = 0.501;

export let image = {
  w: 200,
  h: function() {
    return this.w * other_img_ratio;
  },
  x: 300,
  y: 300,
  w_bound: 200,
  h_bound: 400,
  spatial_randomness: 400,
  temporal_randomness: 0.9,
  size_random_max: 400,
  size_random_min: 200,
  last_x: 0,
  last_y: 0,
  draw_count: 0,
  lined: false,
  margin: 40,
  to_draw: false,
};

e(() => {
  type.y_bound = mouse().y;
  type.x_bound = mouse().x > 100 ? 100 : mouse().x;
});

export let start, canvas, ctx, stat;
let text = "";

export let img_db: any = {};

export let tl: any = {
  cur_audio: new Audio(),
  draw_stats: false,
  chapter: 1,
  act: 1,
  sequence: 1,
  image_set: 0,
  image_index: 0,
  text_index: 0,
  typing: false,
  resetting: false,
  elapsed: 0,
  clear_rate: 0.03,
};

export let sequencer = {
  rotation_one: 1,
  rotation_four: 1,

  sequence_two: function() {
    tl.sequence = 2;
    set_this_chapter(1);
    timer.reset();
    set_chapter(1);
    tl.chapter = 1;
    tl.line = 0;
    tl.resetting = true;
    tl.image_set = 0;
    tl.image_index = 0;
    tl.text_index = 0;
    tl.typing = false;
    tl.elapsed = 0;
    tl.clear_rate = 1;
    // tl.draw_stats = false;
    type.disturbance = 0;
    image.spatial_randomness = 0;
    timer.image.interval = 50;
    image.temporal_randomness = 0;
    image.size_random_max = window.innerWidth;
    image.size_random_min = window.innerWidth;
    image.x = 0;
    image.y = (window.innerHeight - window.innerWidth * other_img_ratio) / 2;
    image.lined = false;
    image.margin = 40;
    image.to_draw = true;
    image.draw_count = 0;
    reset_type();
    // current_climate.set();
  },

  next_chapter: function() {
    if (parseInt(tl.chapter) === 3) this.three();
    else if (parseInt(tl.chapter) === 4) this.four();
    else this.just_go_next();
  },

  just_go_next: function() {
    if (parseInt(tl.chapter) < 7) {
      set_next_chapter(parseInt(tl.chapter) + 1);
    } else {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (loops === 0) {
        setTimeout(function() {
          sequencer.sequence_two();
        }, 2500);
      } else {
        sequencer.sequence_two();
      }

      loops++;
    }
  },

  three: function() {
    if (this.rotation_one < 3) {
      set_next_chapter(1);
      this.rotation_one++;
    } else {
      this.just_go_next();
    }
  },

  four: function() {
    if (this.rotation_four < 3) {
      set_next_chapter(4);
      this.rotation_four++;
    } else {
      this.just_go_next();
    }
  },
};

let timer = {
  type: {
    interval: 50,
    next_draw: 50,
  },
  image: {
    interval: 100.1,
    next_draw: 200,
  },
  reset: function() {
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
  "7": 0,
};

// this holds the state of the chapter selection bar
const [next_chapter, set_next_chapter] = s(0);
const [this_chapter, set_this_chapter] = s(0);

// Main Div that has everything, including our Canvas
const Root = () => {
  return h(
    "div",
    {
      style: {
        display: "flex",
        background: "black",
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
    setup();

    // document.getElementById("intro")?.addEventListener("ended", () => {
    //   set_next_chapter(1);
    // });
  });

  let style = {
    position: "fixed",
    top: "0px",
    left: "0px",
  };

  return [
    // h("video", {
    //   id: "intro",
    //   src: "intro.mp4",
    //   autoplay: true,
    //   loop: false,
    //   height: window.innerHeight,
    // }),
    h("canvas", {
      id: "canvas",
      style,
      width: window.innerWidth,
      height: window.innerHeight,
    }),
    h("canvas", {
      id: "canvas_stats",
      style,
      width: window.innerWidth,
      height: window.innerHeight,
    }),
  ];
};

// the buttons that appear at the bottom of the screen
const ChapterSetter = () => {
  const chapters = m(() => {
    let chapters: number[] = [];

    for (let i = 1; i <= next_chapter(); i++) {
      chapters.push(i);
    }
    return tl.sequence === 2 ? [] : chapters;
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
              class: m(() =>
                parseInt(chapter) === next_chapter() &&
                  parseInt(this_chapter()) !== next_chapter()
                  ? "blinking"
                  : "",
              ),
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

const drawing_neck = () => {
  if (parseInt(tl.chapter) === 2) {
    if (parseInt(tl.image_set) === 2) {
      return true;
    }
  }

  return false;
};

const scheduler = {
  draw_type: function() {
    if (tl.typing) {
      ctx.globalCompositeOperation = "screen";
      if (text[tl.text_index] !== " ")
        draw_alphabet(text[tl.text_index], tl.text_index + 3);
      tick.call(timer.type);
      increment_index();
    }
  },
  draw_image: function() {
    if (!current_chapter()) return;
    if (!current_image_set()) return;
    if (tl.clear_rate === 1)
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    tick.call(timer.image);
    increment_image_index();

    if (current_chapter().images[tl.image_set].delay) {
      if (tl.elapsed < current_chapter().images[tl.image_set].delay) return;
    }

    let last_img_ratio = other_img_ratio;
    drawing_neck() ? (other_img_ratio = 0.898) : null;

    if (parseInt(tl.chapter) === 5 && parseInt(tl.sequence) === 1) {
      draw_fifth_chapter();
    } else {
      if (!image.lined) {
        if (Math.random() > image.temporal_randomness)
          draw_image_frame(tl.image_index);
      } else {
        if (image.to_draw) {
          draw_image_frame_line(tl.image_index);

          // reset state
          if (image.draw_count > 3) {
            image.draw_count = 0;
            image.to_draw = false;
          }
        } else {
          // should we draw?
          if (Math.random() > image.temporal_randomness) image.to_draw = true;
        }
      }
    }

    other_img_ratio = last_img_ratio;
  },
  draw_stats: function() {
    if (tl.draw_stats) draw_stats();
  },
  play: function() {
    scheduler.draw_stats();
    is_it_time_to.call(timer.type) ? scheduler.draw_type() : null;
    is_it_time_to.call(timer.image) ? scheduler.draw_image() : null;
    if (tl.chapter > 0 && tl.sequence === 1)
      Math.random() < tl.clear_rate ? not_clear() : null;

    if (loops === 2) {
      console.log("done");
      document.querySelectorAll("audio").forEach((el) => el.pause());
    }
  },
};

const clock = {
  tick: function(timestamp) {
    if (!start) start = timestamp;
    if (tl.resetting) this.reset(timestamp);
    tl.elapsed = timestamp - start;
  },

  reset: function(timestamp) {
    start = timestamp;
    timer.reset();
    tl.resetting = false;
  },
};

function is_it_time_to() {
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
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.fillRect(0, 0, 1200, 800);
};

// Drawing of the stats
const draw_stats = () => {
  stat.clearRect(0, 0, window.innerWidth, window.innerHeight);
  stat.fillStyle = "white";
  stat.font = "9px monospace";

  let s = 300 / 96;

  let w = parseInt(canvas.width) / s;
  let h = parseInt(canvas.height) / s;

  if (tl.sequence === 1) {
    // top left
    stat.fillText(
      "current time: ".toUpperCase() + Math.floor(tl.elapsed / 1000) + "s",
      10,
      50,
    );

    stat.fillText("image size: ".toUpperCase() + image.w + "px", 10, 60);
    stat.fillText(
      "image spatial randomness: ".toUpperCase() +
      image.spatial_randomness +
      "px",
      10,
      70,
    );
    stat.fillText(
      "image temporal randomness: ".toUpperCase() +
      image.temporal_randomness +
      "%",
      10,
      80,
    );

    stat.fillText(
      "image min: ".toUpperCase() + image.size_random_min + "px",
      10,
      90,
    );
    stat.fillText(
      "image max: ".toUpperCase() + image.size_random_max + "px",
      10,
      100,
    );

    // top right
    stat.fillText(
      "type disturbance: ".toUpperCase() + "+-" + Math.floor(type.disturbance),
      10,
      h - 50,
    );

    stat.fillText(
      "clear rate: ".toUpperCase() + "+-" + tl.clear_rate * 100 + "%",
      10,
      h - 60,
    );

    // bottom left
    if (tl.chapter === 0) stat.fillText("prologue".toUpperCase(), w - 100, 50);
    else stat.fillText("chapter: ".toUpperCase() + tl.chapter, w - 100, 50);

    // bottom right
    stat.fillText("line: ".toUpperCase() + tl.line, w - 100, h - 50);
  } else {
    stat.fillText("loops: ".toUpperCase() + loops, w - 100, h - 50);
  }
};

// draws the alphabet, the main type stuff
const draw_alphabet = (letter: string, index) => {
  if (img_db.type) {
    letter = letter.toLowerCase();
    let x = type.x_bound + ((index - type.last_line_end) * type.width) / 2;

    if (x > type.w_bound) {
      type.line++;
      type.last_line_end = index - 1;
      x = type.x_bound;
    }

    let y = type.y_bound;
    // + type.line * type.height();
    let hr = Math.random() * type.disturbance * pos_or_neg();
    let wr = Math.random() * type.disturbance * pos_or_neg();

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

const draw_image_frame_line = (index) => {
  // skip
  if (current_image_set()) {
    let x_disturbance = Math.random() * image.spatial_randomness * pos_or_neg();
    let y_distrubance = Math.random() * image.spatial_randomness * pos_or_neg();

    let margins = image.draw_count * image.margin;
    let x = image.x + x_disturbance;
    let y = image.y + y_distrubance;

    ctx.globalCompositeOperation = "source-over";

    image.w = Math.floor(
      Math.random() * (image.size_random_max - image.size_random_min) +
      image.size_random_min,
    );

    let w = image.w;
    let h = image.h();

    if (image.draw_count === 0) {
      image.last_x = x;
      image.last_y = y;
    } else {
      x = image.last_x + w * image.draw_count + margins;
      y = image.last_y;
    }

    // ctx.globalCompositeOperation = "exclusion";
    ctx.drawImage(img_db[current_image_set().name][index], x, y, w, h);
    image.draw_count++;
  }
};

const draw_fifth_chapter = () => {
  // skip
  if (current_image_set()) {
    let x = 200;
    let y = 200;

    ctx.globalCompositeOperation = "source-over";

    image.w = window.innerWidth - 400;

    let w = image.w;
    let h = image.h();

    // ctx.globalCompositeOperation = "exclusion";
    ctx.drawImage(img_db[current_image_set().name][20], x, y, w, h);
  }
};

const draw_image_frame = (index) => {
  // skip
  if (current_image_set()) {
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
  // clear entire screen after 6
  if (parseInt(number) === 7) {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  tl.chapter = number;
  set_this_chapter(number);
  tl.line = 1;
  tl.resetting = true;
  tl.image_set = 0;
  tl.image_index = 0;

  if (parseInt(number) === 0) return;

  type.disturbance = disturbance[tl.chapter];
  tl.text_index = 0;

  start_lines();
  current_climate.set();
  tl.cur_audio.play();
  tl.cur_audio.onended = (event) => {
    done_playing();
  };
};

// also a procedure
// starts line of current chapter
const start_lines = () => {
  if (tl.sequence === 2) return;
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
    disturbance: disturbance[tl.chapter],

    width: 150,
    height: function() {
      return this.width * img_ratio;
    },
  };
}

// increments the text index, if its the last letter,
// will unlock next chapter and stop the animations
const increment_index = () => {
  if (tl.text_index < text.length - 1) tl.text_index++;
};

const done_playing = () => {
  if (loops === 20) location.reload();
  if (parseInt(tl.sequence) === 2 && parseInt(tl.chapter) < 7) {
    set_chapter(parseInt(tl.chapter) + 1);
  } else setTimeout(() => sequencer.next_chapter(), 200);

  // if within the rotation of four, signal to blink again
  // Hacky way to do this, but it works
  if (parseInt(tl.chapter) === 4 && sequencer.rotation_four < 3) {
    set_this_chapter(3);
  }

  tl.typing = false;
};

function tick() {
  this.next_draw += this.interval;
}

function setup() {
  canvas = document.getElementById("canvas") as HTMLCanvasElement;
  ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  let canvas_stats = document.getElementById("canvas_stats");
  // @ts-ignore
  stat = canvas_stats?.getContext("2d");

  canvas_stats?.addEventListener("mousemove", (e) => {
    set_mouse({ x: e.clientX, y: e.clientY });
  });

  setDPI(canvas, 300);
  setDPI(canvas_stats, 300);

  load_all_images(img_db);

  // to start off
  set_chapter("7");
  sequencer.rotation_one = 3;
  // sequencer.sequence_two();

  // setTimeout(() => { set_next_chapter("1");
  // }, 5500);

  setTimeout(() => {
    requestAnimationFrame(canvas_loop);
  }, 100);
}

reset_type();
render(Root, document.querySelector(".root"));
