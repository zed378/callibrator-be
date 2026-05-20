const cron = require('node-cron');
const { logger } = require('./activityLog');

const JSZip = require('jszip');
const fse = require('fs-extra');
const path = require('path');
const storagePath = require('../utils/storagePath');
const moment = require('moment-timezone');
const cronExp = process.env.BACKUP_SCHEDULER;

const rootDir = path.join(__dirname, '../../');
const backupFolder = storagePath('backup');
// const backupFolder = path.join(rootDir, "backup");

async function addFolderToZip(zip, folderPath, folderName = '') {
  const files = await fse.readdir(folderPath);

  for (const fileName of files) {
    const fullPath = path.join(folderPath, fileName);
    const fileStat = await fse.stat(fullPath);

    if (fileStat.isDirectory()) {
      const subFolderName = path.join(folderName, fileName);
      await addFolderToZip(zip, fullPath, subFolderName);
    } else {
      const fileData = await fse.readFile(fullPath);
      zip.file(path.join(folderName, fileName), fileData);
    }
  }
}

async function zipFolder(source, out) {
  const zip = new JSZip();
  await addFolderToZip(zip, source);
  const zipContent = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
  await fse.writeFile(out, zipContent);
}

async function backupAndZip() {
  const prefix = moment().tz('Asia/Jakarta').format('YYYY-MMMM-DD HH~mm~ss');

  const dataSourceDir = path.join(rootDir, 'data');
  const logSourceDir = path.join(rootDir, 'log');
  const backupDir = path.join(rootDir, 'backup');

  const dataOutPath = path.join(backupDir, `${prefix}-data.zip`);
  const logOutPath = path.join(backupDir, `${prefix}-log.zip`);

  const tempDataBackupDir = path.join(backupDir, `${prefix}-data`);
  const tempLogBackupDir = path.join(backupDir, `${prefix}-log`);

  try {
    await fse.ensureDir(backupDir);

    // Only backup log folder if it exists
    if (await fse.pathExists(logSourceDir)) {
      await fse.copy(logSourceDir, tempLogBackupDir, {
        overwrite: true,
        dereference: true,
      });

      await zipFolder(tempLogBackupDir, logOutPath);
      console.log('Log folder successfully zipped!');
      logger.info('Log folder successfully zipped!');

      await fse.remove(tempLogBackupDir);
    } else {
      console.log('Log folder does not exist, skipping log backup');
      logger.info('Log folder does not exist, skipping log backup');
    }

    await fse.copy(dataSourceDir, tempDataBackupDir, {
      filter: (src) => !src.endsWith('mysql.sock'),
    });

    await zipFolder(tempDataBackupDir, dataOutPath);
    console.log('Data folder successfully zipped!');
    logger.info('Data folder successfully zipped!');

    await fse.remove(tempDataBackupDir);

    console.log('Temporary folders successfully deleted!');
    logger.info('Temporary folders successfully deleted!');
  } catch (err) {
    console.error('Error during backup and zipping process:', err);
    logger.error('Error during backup and zipping process:', err);
  }
}

async function extractZip(filePath, destDir) {
  const zip = new JSZip();
  const data = await fse.readFile(filePath);
  const zipContent = await zip.loadAsync(data);

  await Promise.all(
    Object.keys(zipContent.files).map(async (fileName) => {
      const file = zipContent.files[fileName];
      if (!file.dir) {
        const content = await file.async('nodebuffer');
        const filePath = path.join(destDir, fileName);
        try {
          await fse.outputFile(filePath, content);
        } catch (err) {
          console.error(
            `Failed to write file: ${filePath}, Error: ${err.message}`,
          );
        }
      }
    }),
  );
}

async function deleteOldFiles() {
  try {
    const files = await fse.readdir(backupFolder);

    const now = moment();

    for (const file of files) {
      const filePath = path.join(backupFolder, file);
      const fileStat = await fse.stat(filePath);

      const fileAgeInDays = now.diff(moment(fileStat.mtime), 'days');

      if (fileAgeInDays > 30) {
        await fse.remove(filePath);
        console.log(`Deleted: ${filePath}`);
        logger.info(`Deleted: ${filePath}`);
      }
    }
  } catch (error) {
    console.error(`Error deleting old files: ${error.message}`);
    logger.error(`Error deleting old files: ${error.message}`);
  }
}

const cronBackup = () => {
  const message =
    cronExp !== '0 0 * * *'
      ? `You set cron expression as ${cronExp}`
      : 'Cron job started at 00:00 AM +0700';
  console.log(message);
  logger.info(message);

  cron.schedule(cronExp ? cronExp : '0 0 * * *', async () => {
    console.log('Running backup data folder');
    logger.info('Running backup data folder');

    try {
      await backupAndZip();
      await deleteOldFiles();
      console.log('Backup completed successfully');
      logger.info('Backup completed successfully');
    } catch (error) {
      console.error('Error during cron backup:', error.message);
      logger.error('Error during cron backup:', error.message);
    }
  });
};

module.exports = { backupAndZip, cronBackup, extractZip, deleteOldFiles };
