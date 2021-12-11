const express = require('express');

const fileUpload = require('express-fileupload');
const morgan = require('morgan');
const path = require('path');
const sharp = require('sharp');
const util = require('util');

const app = express();
const port = process.env.PORT || 5000;
const imagesPath = path.join(__dirname, '../public/images');
const images = [];

app.use(morgan('dev'));

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/',
    preserveExtension: true,
  })
);

app.use((req, res, next) => {
  if (req.files && req.files.image) {
    const {image} = req.files;
    image.mv = util.promisify(image.mv);
  }
  next();
});

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../bin/www')));

app.post('/images', async (req, res, next) => {
  try {
    if (!req.files || !req.files.image) {
      res.status(400).send('File not uploaded!');
      return;
    }
    const {image} = req.files;
    if (!/^image\//.test(image.mimetype)) {
      res.status(400).send('Invalid type!');
      return;
    }
    const imageName = `image_${images.length + 1}`;
    const imageExt = image.name.split('.').pop();
    const imageFullName = `${imageName}.${imageExt}`;
    const imagePath = path.join(imagesPath, imageFullName);
    await image.mv(imagePath);
    images.push({
      name: imageName,
      ext: imageExt,
      fullName: imageFullName,
      path: imagePath,
      croppedImages: [],
    });
    res.json({name: imageFullName});
  } catch (error) {
    next(error);
  }
});

app.post(
  '/crop/:imageName(image_[1-9][0-9]{0,}.[a-zA-Z0-9]{1,})',
  async (req, res, next) => {
    try {
      const {imageName} = req.params;
      const left = parseInt(req.query.left, 10);
      const top = parseInt(req.query.top, 10);
      const width = parseInt(req.query.width, 10);
      const height = parseInt(req.query.height, 10);
      const filteredImages = images.filter(
        image => image.fullName === imageName
      );
      if (filteredImages.length === 0) {
        res.send('Image not found!');
        return;
      }
      const image = filteredImages[0];
      const croppedImageName = `${image.name}_${
        image.croppedImages.length + 1
      }`;
      const croppedImageExt = image.ext;
      const croppedImageFullName = `${croppedImageName}.${croppedImageExt}`;
      const croppedImagePath = path.join(imagesPath, croppedImageFullName);
      await sharp(image.path)
        .extract({left, top, width, height})
        .toFile(croppedImagePath);
      image.croppedImages.push({
        name: croppedImageName,
        ext: croppedImageExt,
        fullName: croppedImageFullName,
        path: croppedImagePath,
      });
      res.json({name: croppedImageFullName});
    } catch (error) {
      next(error);
    }
  }
);

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(error.stack);
  res.status(500).send('Something broke!');
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
});
