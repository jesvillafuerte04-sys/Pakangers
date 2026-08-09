/* @ds-bundle: {"format":4,"namespace":"DesignSystem_95a9a3","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"BottomNav","sourcePath":"components/navigation/BottomNav.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"2fed52f2c80b","components/core/Button.jsx":"9f197d685c7c","components/core/Card.jsx":"a7e59846216a","components/core/Input.jsx":"b08aa01b73a9","components/navigation/BottomNav.jsx":"2ef683439021","ui_kits/mobile_app/screens.jsx":"660017678b40"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DesignSystem_95a9a3 = window.DesignSystem_95a9a3 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const tones = {
  gold: {
    background: 'var(--color-gold)',
    color: 'var(--color-navy)'
  },
  navy: {
    background: 'var(--color-navy)',
    color: 'var(--color-gold)'
  },
  success: {
    background: 'var(--color-success)',
    color: '#fff'
  },
  error: {
    background: 'var(--color-error)',
    color: '#fff'
  },
  neutral: {
    background: 'var(--surface-sunken)',
    color: 'var(--color-text-muted)'
  }
};
function Badge({
  tone = 'gold',
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 12px',
      borderRadius: 'var(--radius-pill)',
      fontFamily: 'var(--font-ui)',
      fontWeight: 600,
      fontSize: '.75rem',
      letterSpacing: '1px',
      textTransform: 'uppercase',
      ...tones[tone],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const base = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-sm)',
  fontFamily: 'var(--font-ui)',
  fontWeight: 600,
  fontSize: '1rem',
  borderRadius: 'var(--radius-pill)',
  border: '2px solid transparent',
  cursor: 'pointer',
  transition: 'var(--transition-base)',
  textDecoration: 'none'
};
const sizes = {
  sm: {
    padding: '8px 18px',
    fontSize: '.9rem'
  },
  md: {
    padding: '14px 28px'
  },
  lg: {
    padding: '18px 36px',
    fontSize: '1.1rem'
  }
};
const variants = {
  primary: {
    backgroundColor: 'var(--color-navy)',
    color: 'var(--color-gold)'
  },
  secondary: {
    backgroundColor: 'var(--color-gold)',
    color: 'var(--color-navy)'
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: 'var(--color-navy)',
    color: 'var(--color-navy)'
  }
};
function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    style: {
      ...base,
      ...sizes[size],
      ...variants[variant],
      width: fullWidth ? '100%' : undefined,
      opacity: disabled ? .5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Card({
  title,
  accent = true,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-lg)',
      boxShadow: 'var(--shadow-md)',
      position: 'relative',
      overflow: 'hidden',
      ...style
    }
  }, rest), accent && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: 6,
      background: 'var(--color-gold)'
    }
  }), title && /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase',
      fontWeight: 700,
      fontSize: '1.25rem',
      lineHeight: 1.2,
      margin: '0 0 var(--space-xs)'
    }
  }, title), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  label,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'left',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-xs)'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontWeight: 500,
      fontSize: '.9rem',
      color: 'var(--color-navy)',
      fontFamily: 'var(--font-ui)'
    }
  }, label), /*#__PURE__*/React.createElement("input", _extends({
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      padding: '12px 16px',
      border: '2px solid ' + (focus ? 'var(--color-gold)' : 'var(--border-subtle)'),
      borderRadius: 'var(--radius-md)',
      fontFamily: 'var(--font-ui)',
      fontSize: '1rem',
      color: 'var(--color-text-main)',
      background: 'var(--color-white)',
      outline: 'none',
      boxShadow: focus ? '0 0 0 3px var(--focus-ring)' : 'none',
      transition: 'var(--transition-base)',
      ...style
    }
  }, rest)));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/navigation/BottomNav.jsx
try { (() => {
const ICONS = {
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  matches: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
  profile: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'
};
function BottomNav({
  items,
  value,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      justifyContent: 'space-around',
      background: 'var(--color-navy)',
      padding: 'var(--space-sm) 0 var(--space-md)',
      boxShadow: 'var(--shadow-nav)',
      ...style
    }
  }, items.map(it => {
    const active = it.id === value;
    return /*#__PURE__*/React.createElement("div", {
      key: it.id,
      onClick: () => onChange && onChange(it.id),
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'var(--font-ui)',
        fontSize: '.75rem',
        cursor: 'pointer',
        transition: 'color .2s ease',
        color: active ? 'var(--color-gold)' : 'var(--color-nav-inactive)'
      }
    }, /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      style: {
        width: 24,
        height: 24,
        marginBottom: 4,
        fill: 'currentColor'
      }
    }, /*#__PURE__*/React.createElement("path", {
      d: ICONS[it.icon] || ICONS.home
    })), /*#__PURE__*/React.createElement("span", null, it.label));
  }));
}
Object.assign(__ds_scope, { BottomNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/BottomNav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/screens.jsx
try { (() => {
const {
  Button,
  Input,
  Card,
  Badge,
  BottomNav
} = window.DesignSystem_95a9a3;
const MATCHES = [{
  id: 1,
  round: 'Quarter-final',
  court: 'Court 1',
  time: '10:00 AM',
  a: 'J. Reyes / M. Cruz',
  b: 'A. Tan / R. Lim',
  state: 'Live'
}, {
  id: 2,
  round: 'Quarter-final',
  court: 'Court 2',
  time: '11:30 AM',
  a: 'P. Santos / D. Uy',
  b: 'K. Chua / B. Ong',
  state: 'Upcoming'
}, {
  id: 3,
  round: 'Group B',
  court: 'Court 3',
  time: 'Yesterday',
  a: 'J. Reyes / M. Cruz',
  b: 'L. Diaz / F. Yap',
  state: 'Won'
}];
const Screen = ({
  children
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--space-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-lg)'
  }
}, children);
const Title = ({
  children,
  sub
}) => /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
  style: {
    fontFamily: 'var(--font-display)',
    textTransform: 'uppercase',
    fontWeight: 900,
    fontSize: '1.9rem',
    letterSpacing: 1,
    lineHeight: 1.2,
    margin: 0
  }
}, children), sub && /*#__PURE__*/React.createElement("div", {
  style: {
    color: 'var(--color-text-muted)',
    fontSize: '.9rem'
  }
}, sub));
function MatchRow({
  m,
  onOpen
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: () => onOpen(m),
    style: {
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      padding: 'var(--space-md)',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '.75rem',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: 'var(--color-text-muted)'
    }
  }, m.round, " • ", m.court), /*#__PURE__*/React.createElement(Badge, {
    tone: m.state === 'Live' ? 'error' : m.state === 'Won' ? 'success' : 'neutral'
  }, m.state)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase',
      fontSize: '1rem'
    }
  }, m.a), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase',
      fontSize: '1rem',
      color: 'var(--color-text-muted)'
    }
  }, m.b), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '.85rem',
      color: 'var(--color-text-muted)'
    }
  }, m.time));
}
function Home({
  onOpen
}) {
  return /*#__PURE__*/React.createElement(Screen, null, /*#__PURE__*/React.createElement(Title, {
    sub: "Pakangers Open • Day 2"
  }, "Tournament 2026"), /*#__PURE__*/React.createElement(Card, {
    title: "Next Match"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--color-text-muted)',
      margin: '0 0 var(--space-lg)'
    }
  }, "Court 1 • 10:00 AM • vs A. Tan / R. Lim"), /*#__PURE__*/React.createElement(Button, {
    fullWidth: true,
    onClick: () => onOpen(MATCHES[0])
  }, "View Details")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase',
      fontSize: '1.1rem',
      marginBottom: 'var(--space-sm)',
      borderBottom: '2px solid var(--color-gold)',
      display: 'inline-block',
      paddingBottom: 4
    }
  }, "Today"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-sm)'
    }
  }, MATCHES.slice(0, 2).map(m => /*#__PURE__*/React.createElement(MatchRow, {
    key: m.id,
    m: m,
    onOpen: onOpen
  })))));
}
function Matches({
  onOpen
}) {
  const [tab, setTab] = React.useState('All');
  return /*#__PURE__*/React.createElement(Screen, null, /*#__PURE__*/React.createElement(Title, {
    sub: "12 matches scheduled"
  }, "Match Results"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-sm)'
    }
  }, ['All', 'Live', 'Mine'].map(t => /*#__PURE__*/React.createElement(Button, {
    key: t,
    size: "sm",
    variant: t === tab ? 'primary' : 'outline',
    onClick: () => setTab(t)
  }, t))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-sm)'
    }
  }, MATCHES.filter(m => tab === 'Live' ? m.state === 'Live' : true).map(m => /*#__PURE__*/React.createElement(MatchRow, {
    key: m.id,
    m: m,
    onOpen: onOpen
  }))));
}
function Profile() {
  return /*#__PURE__*/React.createElement(Screen, null, /*#__PURE__*/React.createElement(Title, {
    sub: "Pakangers Elite • Seed #3"
  }, "Julio Reyes"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-sm)'
    }
  }, /*#__PURE__*/React.createElement(Badge, null, "Seeded"), /*#__PURE__*/React.createElement(Badge, {
    tone: "navy"
  }, "Men's Doubles")), /*#__PURE__*/React.createElement(Card, {
    title: "Player Statistics"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 'var(--space-md)',
      textAlign: 'center'
    }
  }, [['18', 'Played'], ['13', 'Won'], ['72%', 'Win rate']].map(([v, l]) => /*#__PURE__*/React.createElement("div", {
    key: l
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.8rem',
      fontWeight: 900,
      color: 'var(--color-navy)'
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '.8rem',
      color: 'var(--color-text-muted)'
    }
  }, l))))), /*#__PURE__*/React.createElement(Card, {
    title: "Edit Registration",
    accent: false
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Player Name",
    defaultValue: "Julio Reyes"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Team Designation",
    defaultValue: "Pakangers Elite"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    fullWidth: true
  }, "Save Changes"))));
}
function Detail({
  m,
  onBack
}) {
  return /*#__PURE__*/React.createElement(Screen, null, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "outline",
    onClick: onBack
  }, "← Back"), /*#__PURE__*/React.createElement(Title, {
    sub: m.round + ' • ' + m.court + ' • ' + m.time
  }, "Match Detail"), /*#__PURE__*/React.createElement(Card, {
    title: m.state
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-sm)'
    }
  }, [[m.a, '6 6'], [m.b, '4 3']].map(([n, s]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      borderBottom: '1px solid var(--border-subtle)',
      paddingBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase'
    }
  }, n), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      letterSpacing: 4
    }
  }, s))))), /*#__PURE__*/React.createElement(Button, {
    fullWidth: true
  }, "Follow this match"));
}
function App() {
  const [tab, setTab] = React.useState('home');
  const [detail, setDetail] = React.useState(null);
  const items = [{
    id: 'home',
    label: 'Home',
    icon: 'home'
  }, {
    id: 'matches',
    label: 'Matches',
    icon: 'matches'
  }, {
    id: 'profile',
    label: 'Profile',
    icon: 'profile'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 390,
      height: 800,
      background: 'var(--surface-page)',
      borderRadius: 'var(--radius-sheet)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: 'var(--shadow-lg)',
      color: 'var(--color-text-main)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-navy)',
      padding: '12px var(--space-lg)',
      borderBottom: '4px solid var(--color-gold)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 900,
      textTransform: 'uppercase',
      letterSpacing: 2,
      color: 'var(--color-gold)'
    }
  }, "Pakangers"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'rgba(255,255,255,.8)',
      fontSize: '.8rem'
    }
  }, "9:41")), detail ? /*#__PURE__*/React.createElement(Detail, {
    m: detail,
    onBack: () => setDetail(null)
  }) : tab === 'home' ? /*#__PURE__*/React.createElement(Home, {
    onOpen: setDetail
  }) : tab === 'matches' ? /*#__PURE__*/React.createElement(Matches, {
    onOpen: setDetail
  }) : /*#__PURE__*/React.createElement(Profile, null), /*#__PURE__*/React.createElement(BottomNav, {
    items: items,
    value: tab,
    onChange: id => {
      setDetail(null);
      setTab(id);
    }
  }));
}
Object.assign(window, {
  App
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/screens.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.BottomNav = __ds_scope.BottomNav;

})();
