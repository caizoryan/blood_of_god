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

export const load_images = (images: { key: string; src: string }[]) => {
  let alphabets: any = {};
  images.forEach((image) => {
    const img = new Image();
    img.src = image.src;

    alphabets[image.key] = img;
  });

  return alphabets;
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
  console.log(roman);
  return roman;
}
