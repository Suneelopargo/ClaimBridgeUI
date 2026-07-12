import './Footer.css'

export default function Footer({ children }) {
  return (
    <>
      <footer className="app-footer" role="contentinfo">
        <p>
          © 2026-2027{' '}
          <a href="https://www.solventek.com/" target="_blank" rel="noreferrer">
            Solventek Pvt Ltd.
          </a>{' '}
          All rights reserved.
        </p>
      </footer>

      {children}
    </>
  )
}
