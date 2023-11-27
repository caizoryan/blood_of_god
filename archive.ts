const draw_alphabet = (letter: string, index) => {
  if (img_db.type) {
    let x = type.x_bound + ((index - type.last_line_end) * type.width) / 2;

    if (x > type.w_bound) {
      type.line++;
      type.last_line_end = index - 1;
      x = type.x_bound;
    }

    let y = type.y_bound + type.line * type.height();
    let hr = Math.random() * tl.disturbance;
    if (Math.random() > 0.5) hr *= -1;
    let wr = hr;

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
