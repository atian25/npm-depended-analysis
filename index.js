import pDoWhilst from 'p-do-whilst';
import pMap from 'p-map';
import { request } from 'undici';

class Analysis {

  async run(name) {
    const result = new Map();
    const dependedList = await this.fetchDependedList(name);

    console.log('# package name:', name);
    console.log(`# depended list: ${dependedList.length}`);

    await pMap(dependedList, async dependedName => {
      const [ downloadCount, pkgInfo ] = await Promise.all([
        this.fetchDownloadCount(dependedName),
        this.fetchPackageInfo(dependedName),
      ]);
      const latestPkgInfo = pkgInfo.versions[pkgInfo['dist-tags'].latest];
      result.set(dependedName, {
        packageName: `${dependedName}@${latestPkgInfo.version}`,
        downloadCount,
        publishTime: pkgInfo.modified,
        dependencyVersion: `${name}@${latestPkgInfo.dependencies[name]}`,
      });
    }, { concurrency: 10 });

    const list = [ ...result.values() ]
      .sort((a, b) => b.downloadCount - a.downloadCount)
      .filter(item => item.downloadCount > 100);

    console.table(list);
  }

  async fetchPackageInfo(name) {
    const url = `https://registry.npmmirror.com/${name}`;
    const response = await this.requestJSON(url, {
      headers: { accept: 'application/vnd.npm.install-v1+json' },
    });
    return response;
  }

  async requestJSON(url, options) {
    const { body } = await request(url, options);
    return body.json();
  }

  async fetchDependedList(name) {
    const result = [];
    let hasNext = true;
    let offset = 0;

    await pDoWhilst(async () => {
      const url = `https://www.npmjs.com/browse/depended/${name}?offset=${offset}`;
      // console.log('# request', url);
      const response = await this.requestJSON(url, {
        headers: { 'x-spiferack': 1 },
      });

      hasNext = response.hasNext;
      // hasNext = false
      offset += response.paginationSize;

      for (const pkgInfo of response.packages) {
        result.push(pkgInfo.name);
      }

    }, () => hasNext);

    return result;
  }

  async fetchDownloadCount(name, range = 'last-week') {
    const url = `https://api.npmjs.org/downloads/point/${range}/${name}`;
    const response = await this.requestJSON(url);
    return response.downloads;
  }
}

const instance = new Analysis();
await instance.run('node-ipc');
// console.log(result);
