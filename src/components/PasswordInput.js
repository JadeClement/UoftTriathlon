import React, { useState } from 'react';
import './PasswordInput.css';

const PasswordInput = ({
  id,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  minLength,
  autoComplete,
  className = ''
}) => {
  const [visible, setVisible] = useState(false);

  const revealPassword = (event) => {
    event.preventDefault();
    setVisible(true);
  };

  const hidePassword = () => {
    setVisible(false);
  };

  return (
    <div className="password-input-wrapper">
      <input
        type={visible ? 'text' : 'password'}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className={className}
      />
      <button
        type="button"
        className="password-input-toggle"
        onPointerDown={revealPassword}
        onPointerUp={hidePassword}
        onPointerLeave={hidePassword}
        onPointerCancel={hidePassword}
        aria-label="Hold to show password"
        title="Hold to show password"
      >
        <svg
          className="password-input-eye"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
        </svg>
      </button>
    </div>
  );
};

export default PasswordInput;
