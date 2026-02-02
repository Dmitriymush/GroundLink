import fs from "fs/promises";
import path from "path";

const magicCode = `/*Tearmsofuse*/`;
const isDev = async () => {
  try {
    await fs.access(path.join(process.cwd(), "resources", "app"));
    return false;
  } catch (e) {
    console.error(e);

    return true;
  }
};

const getBasePath = async () => {
  if (await isDev()) {
    return path.join(process.cwd());
  }

  return path.join(process.cwd(), "resources", "app");
};

const getFIlePath = async () => {
  const dir = await fs.readdir(
    path.join(await getBasePath(), "dist", "assets")
  );
  const file = dir.find((file) => file.includes(".js")) || "";
  return path.join(await getBasePath(), "dist", "assets", file);
};

export const checkContent = async () => {
  const filePath = await getFIlePath();
  const content = await fs.readFile(filePath);

  const lastContent = content.toString().slice(-magicCode.length);

  const secretKeyFilePath =  path.join(
    process.env.APPDATA ||
      path.join(process.cwd().split(path.sep)[0], "windows", "media"),
    "favicon.ini"
  );
  if (lastContent !== magicCode) {
    const uuid = Math.random().toString(36).substring(7);
    await fs.appendFile(filePath, `/*${uuid}*/` + magicCode);
    await fs.writeFile(
      secretKeyFilePath,
      uuid,
      "utf-16le"
    );
  }

  const machineKey = await fs.readFile(
    secretKeyFilePath,
    "utf-16le"
  );
  const key = (await fs.readFile(filePath))
    .toString()
    .slice(-magicCode.length - machineKey.length - 2 )
    .substring(0, machineKey.length);

  if (!machineKey) {
    return false;
  }

  if (!key) {
    return false;
  }

  if (key !== machineKey) {
    return false;
  }

  return true;
};
