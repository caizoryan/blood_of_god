import { tl } from ".";
import { sequence_1 } from "./data";

export function setDPI(canvas, dpi) {
  // Set up CSS size.
  canvas.style.width = canvas.style.width || canvas.width + "px";
  canvas.style.height = canvas.style.height || canvas.height + "px";

  // Resize canvas and scale future draws.
  var scaleFactor = dpi / 96;
  canvas.width = Math.ceil(canvas.width * scaleFactor);
  canvas.height = Math.ceil(canvas.height * scaleFactor);
  var ctx = canvas.getContext("2d");
  ctx.scale(scaleFactor, scaleFactor);
}

export const make_alphabet_dataset = () => {
  let alphabet = "abcdefghijklmnopqrstuvwxyz".split("");

  let images = alphabet.map((letter) => {
    let up = {
      key: letter.toUpperCase(),
      src: `./alphabets/${letter}C.png`,
    };

    let low = {
      key: letter.toLowerCase(),
      src: `./alphabets/${letter}.png`,
    };

    if (letter === "a")
      low = {
        key: letter.toLowerCase(),
        src: `./alphabets/${letter}.jpg`,
      };

    return [up, low];
  });

  return images.flat();
};

export const make_new_alphabet_dataset = () => {
  let alphabet = "abcdefghijklmnopqrstuvwxyz".split("");

  let images = alphabet.map((letter) => {
    let up = {
      key: letter.toUpperCase(),
      src: `./new_alphabets/${letter}C.png`,
    };

    let low = {
      key: letter.toLowerCase(),
      src: `./new_alphabets/${letter}.png`,
    };

    return [up, low];
  });

  return images.flat();
};

export const make_frame_dataset = (folder: string, num: number) => {
  let images: any = [];

  for (let i = 1; i <= num; i++) {
    images.push({
      key: folder + i,
      src: `./frames/${folder}/_${i}.png`,
    });
  }

  return images;
};

export const load_images_as_array = (
  dataset: { key: string; src: string }[],
) => {
  let images: any = [];
  dataset.forEach((image) => {
    const img = new Image();
    img.src = image.src;

    images.push(img);
  });

  return images;
};

export const load_images = (images: { key: string; src: string }[]) => {
  let alphabets: any = {};
  images.forEach((image) => {
    const img = new Image();
    img.src = image.src;

    alphabets[image.key] = img;
  });

  return alphabets;
};

export const load_all_images = (db) => {
  db.type = load_images(make_alphabet_dataset());

  for (const value of Object.values(sequence_1)) {
    value.images.forEach((image) => {
      db[image.name] = load_images_as_array(
        make_frame_dataset(image.name, image.frames),
      );
    });
  }
};

export const current_chapter = () => {
  return sequence_1[tl.chapter];
};

export const current_line = () => {
  return current_chapter().lines[tl.line];
};

export const current_image_set = () => {
  if (current_chapter().images.length === 0) return undefined;
  return current_chapter().images[tl.image_set];
};

export const next_image_set = () => {
  if (current_chapter().images.length === 0) return undefined;
  if (tl.image_set + 1 >= current_chapter().images.length) return undefined;
  return current_chapter().images[tl.image_set + 1];
};

export const current_total_duration = () => {
  let current_lines = Object.values(current_chapter().lines);

  let total_duration = 0;
  current_lines.forEach((line) => {
    if (line.end_time > total_duration) total_duration = line.end_time;
  });
  return total_duration;
};

export function romanize(num) {
  var lookup = {
      M: 1000,
      CM: 900,
      D: 500,
      CD: 400,
      C: 100,
      XC: 90,
      L: 50,
      XL: 40,
      X: 10,
      IX: 9,
      V: 5,
      IV: 4,
      I: 1,
    },
    roman = "",
    i;
  for (i in lookup) {
    while (num >= lookup[i]) {
      roman += i;
      num -= lookup[i];
    }
  }
  return roman;
}
