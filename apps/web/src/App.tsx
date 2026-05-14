import { dibaoVersion } from "@dibao/shared";
import styles from "./design-system/AppShell/AppShell.module.css";

const navigationItems = ["推荐", "最新", "收藏", "稍后读", "搜索", "订阅源", "设置"];

export function App() {
  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar} aria-label="主导航">
        <div className={styles.brand}>
          <span className={styles.brandMark}>邸</span>
          <span>
            <strong>邸报</strong>
            <small>Dibao</small>
          </span>
        </div>
        <nav className={styles.nav}>
          {navigationItems.map((item) => (
            <a
              className={item === "推荐" ? styles.navItemActive : styles.navItem}
              href="#"
              key={item}
            >
              {item}
            </a>
          ))}
        </nav>
      </aside>

      <section className={styles.content} aria-labelledby="page-title">
        <header className={styles.topbar}>
          <div>
            <p className={styles.kicker}>MVP Scaffold</p>
            <h1 id="page-title">推荐</h1>
          </div>
          <span className={styles.version}>v{dibaoVersion}</span>
        </header>

        <div className={styles.list}>
          <article className={styles.articleItem}>
            <p className={styles.meta}>少数派 · 2 小时前</p>
            <h2>本地 RSS 与个人化排序的第一版骨架</h2>
            <p>
              当前界面只用于验证 React、Vite、CSS Variables 和工作区结构，
              后续会按低保真线框继续实现真实阅读流程。
            </p>
          </article>
          <article className={styles.articleItemRead}>
            <p className={styles.meta}>The Verge · 今天</p>
            <h2>sqlite-vec Node.js 集成验证已通过</h2>
            <p>
              BLOB 权威存储、vec0 索引、FTS5 查询和索引重建已经通过 spike 验证。
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}

