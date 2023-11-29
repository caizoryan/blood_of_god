import {
  canvas,
  image,
  img_ratio,
  other_img_ratio,
  sequencer,
  tl,
  type,
} from ".";

export let current_climate = {
  set: function () {
    if (parseInt(tl.chapter) === 1 && sequencer.rotation_one === 1)
      this.one_one();

    if (parseInt(tl.chapter) === 1 && sequencer.rotation_one === 2)
      this.one_two();

    if (parseInt(tl.chapter) === 1 && sequencer.rotation_one === 3)
      this.one_three();

    if (parseInt(tl.chapter) === 2 && sequencer.rotation_one === 1)
      this.two_one();

    if (parseInt(tl.chapter) === 2 && sequencer.rotation_one === 2)
      this.two_two();

    if (parseInt(tl.chapter) === 2 && sequencer.rotation_one === 3)
      this.two_three();

    if (parseInt(tl.chapter) === 3 && sequencer.rotation_one === 1)
      this.three_one();

    if (parseInt(tl.chapter) === 3 && sequencer.rotation_one === 2)
      this.three_two();

    if (parseInt(tl.chapter) === 3 && sequencer.rotation_one === 3)
      this.three_three();

    if (parseInt(tl.chapter) === 4 && sequencer.rotation_four === 1)
      this.four_one();

    if (parseInt(tl.chapter) === 4 && sequencer.rotation_four === 2)
      this.four_two();

    if (parseInt(tl.chapter) === 4 && sequencer.rotation_four === 3)
      this.four_three();

    if (parseInt(tl.chapter) === 5) this.five();
    if (parseInt(tl.chapter) === 6) this.six();
    if (parseInt(tl.chapter) === 7) this.seven();
  },

  one_one: function () {
    tl.draw_stats = true;
    tl.clear_rate = 0.03;
    // type disturbance
    type.disturbance = 350;
    // image disturbance
    image.spatial_randomness = 700;
    image.temporal_randomness = 0.94;

    image.size_random_max = 150;
    image.size_random_min = 300;
  },
  two_one: function () {
    tl.clear_rate = 0.03;
    // type disturbance
    type.disturbance = 300;
    // image disturbance
    image.spatial_randomness = 600;
    image.temporal_randomness = 0.88;

    image.size_random_min = 150;
    image.size_random_max = 350;
  },
  three_one: function () {
    tl.clear_rate = 0.03;
    // type disturbance
    type.disturbance = 140;

    // image disturbance
    image.spatial_randomness = 400;
    image.temporal_randomness = 0.86;

    // image.x = window.innerWidth / 2 - 200;

    // image.interval = 200;

    image.size_random_max = 400;
    image.size_random_min = 200;
  },

  one_two: function () {
    tl.clear_rate = 0.03;

    image.spatial_randomness = 300;
    image.temporal_randomness = 0.82;

    image.size_random_max = 400;
    image.size_random_min = 250;
  },
  two_two: function () {
    tl.clear_rate = 0.03;

    image.spatial_randomness = 300;
    image.temporal_randomness = 0.82;

    image.size_random_max = 400;
    image.size_random_min = 250;
  },
  three_two: function () {
    tl.clear_rate = 0.03;

    image.spatial_randomness = 200;
    image.temporal_randomness = 0.62;

    image.size_random_max = 400;
    image.size_random_min = 300;
  },

  one_three: function () {
    tl.clear_rate = 0.03;

    image.spatial_randomness = 200;
    image.temporal_randomness = 0.62;

    image.x = 50;
    image.y = 100;

    image.lined = true;

    image.size_random_max = 400;
    image.size_random_min = 300;
  },
  two_three: function () {
    tl.clear_rate = 0.03;

    image.spatial_randomness = 100;
    image.temporal_randomness = 0.52;

    image.x = 50;
    image.y = 100;

    image.lined = true;

    image.size_random_max = 400;
    image.size_random_min = 300;
  },
  three_three: function () {
    tl.clear_rate = 0.03;

    image.spatial_randomness = 100;
    image.temporal_randomness = 0.52;

    image.x = 50;
    image.y = 100;

    image.lined = true;

    image.size_random_max = 400;
    image.size_random_min = 350;
  },

  four_one: function () {
    image.lined = true;
    // type disturbance
    type.disturbance = 40;

    // image disturbance
    image.spatial_randomness = 200;
    image.temporal_randomness = 0.65;

    image.margin = -50;

    image.x = 50;
    image.y = 200;

    image.size_random_max = 550;
    image.size_random_min = 450;
  },
  four_two: function () {
    image.lined = true;
    // type disturbance
    type.disturbance = 50;

    // image disturbance
    image.spatial_randomness = 150;
    image.temporal_randomness = 0.4;

    image.margin = -250;

    image.size_random_max = 550;
    image.size_random_min = 450;
  },
  four_three: function () {
    image.lined = true;
    // type disturbance
    type.disturbance = 40;

    // image disturbance
    image.spatial_randomness = 100;
    image.temporal_randomness = 0.3;

    image.margin = -450;

    image.size_random_max = 550;
    image.size_random_min = 500;
  },

  five: function () {
    image.lined = true;
    // I have to somehow make this just one image...
  },

  six: function () {
    image.lined = false;
    tl.clear_rate = 0.004;

    image.spatial_randomness = 550;
    image.temporal_randomness = 0;

    image.size_random_max = 550;
    image.size_random_min = 450;
    // all images
  },

  seven: function () {
    image.lined = false;

    tl.clear_rate = 0.03;

    image.spatial_randomness = 20;
    image.temporal_randomness = 0;

    let s = 300 / 96;

    let w = parseInt(canvas.width) / s;
    let h = parseInt(canvas.height) / s;

    image.size_random_max = 950;
    image.size_random_min = 950;
    image.x = w / 2 - image.size_random_max / 2;
    image.y = h / 2 - (image.size_random_max * other_img_ratio) / 2;
    // back to normal
  },
};
