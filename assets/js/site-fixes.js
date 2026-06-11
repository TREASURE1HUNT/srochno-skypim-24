(function () {
  'use strict';

  var API = '/.netlify/functions/submit-form';

  /* --- Progress bars --- */
  document.querySelectorAll('.elementor-progress-bar[data-max]').forEach(function (bar) {
    bar.style.width = bar.getAttribute('data-max') + '%';
  });

  /* --- Мобильное меню --- */
  document.querySelectorAll('.elementor-menu-toggle').forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      var menu = toggle.closest('.elementor-widget-nav-menu');
      if (menu) {
        var dropdown = menu.querySelector('.elementor-nav-menu--dropdown');
        if (dropdown) dropdown.classList.toggle('is-open', !expanded);
      }
    });
  });

  /* --- Попапы Elementor --- */
  var overlay = document.createElement('div');
  overlay.className = 'site-popup-overlay';
  overlay.innerHTML = '<button class="site-popup-close" aria-label="Закрыть">&times;</button>';
  document.body.appendChild(overlay);

  var closeBtn = overlay.querySelector('.site-popup-close');

  function openPopup(id) {
    var popup = document.querySelector('.elementor-' + id);
    if (!popup) return;
    overlay.querySelectorAll('.elementor-location-popup').forEach(function (el) {
      el.remove();
    });
    var clone = popup.cloneNode(true);
    clone.style.display = 'block';
    overlay.appendChild(clone);
    overlay.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
    bindPopupForms(clone);
  }

  function closePopup() {
    overlay.classList.remove('is-visible');
    overlay.querySelectorAll('.elementor-location-popup').forEach(function (el) {
      el.remove();
    });
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', closePopup);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closePopup();
  });

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = decodeURIComponent(link.getAttribute('href'));

    if (href.indexOf('popup:open') !== -1 || href.indexOf('popup%3Aopen') !== -1) {
      e.preventDefault();
      var popupId = null;
      try {
        var settingsMatch = href.match(/settings=([^&]+)/);
        if (settingsMatch) {
          var settings = JSON.parse(atob(settingsMatch[1]));
          popupId = settings.id;
        }
      } catch (err) {}
      if (!popupId) {
        var idMatch = href.match(/id["']?\s*[:=]\s*["']?(\d+)/i);
        if (idMatch) popupId = idMatch[1];
      }
      if (popupId) openPopup(popupId);
      return;
    }
    if (href === '#popup') { e.preventDefault(); openPopup('4882'); }
    if (href === '#popup1') { e.preventDefault(); openPopup('5542'); }
  });

  /* --- Отправка формы --- */
  function collectFields(container) {
    var data = {};
    container.querySelectorAll('input[name], select[name], textarea[name]').forEach(function (el) {
      if (el.type === 'hidden' && ['post_id', 'form_id', 'referer_title', 'queried_id', 'redirect', 'remote_ip'].indexOf(el.name) !== -1) return;
      var m = el.name.match(/^form_fields\[(.+)\]$/);
      if (m) data[m[1]] = el.value;
    });
    return data;
  }

  function fieldLabels(container) {
    return {
      mod: 'Марка и модель',
      vip: 'Год выпуска',
      kor: 'Коробка передач',
      pro: 'Пробег',
      sost: 'Состояние',
      vl: 'Владельцев',
      obr: 'Обременения',
      mest: 'Местоположение',
      tel: 'Телефон',
      field_33e91bb: 'Марка',
      field_4bc3582: 'Модель',
      field_c744db9: 'Год выпуска',
      email12133: 'Телефон',
      field_f84371f: 'Телефон'
    };
  }

  function submitForm(data, formType) {
    var payload = Object.assign({ form_type: formType || 'site' }, data);
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  function showMessage(container, type, text) {
    var sel = type === 'success'
      ? '[data-pafe-form-builder-message*="Спасибо"]'
      : '[data-pafe-form-builder-message*="error"]';
    var msg = container.querySelector(sel) || container.querySelector('.elementor-message-' + type);
    if (msg) {
      if (text) msg.textContent = text;
      msg.classList.add('is-visible');
    }
  }

  /* --- Мультистеп PAFE форма --- */
  document.querySelectorAll('.pafe-multi-step-form').forEach(function (form) {
    var steps = form.querySelectorAll(':scope > .pafe-multi-step-form__content > .elementor > .elementor-top-section');
    var current = 0;

    function showStep(n) {
      steps.forEach(function (s, i) {
        s.classList.toggle('is-active', i === n);
      });
      current = n;
    }

    if (steps.length) showStep(0);

    form.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-pafe-form-builder-nav]');
      if (!btn) return;
      e.preventDefault();
      var dir = btn.getAttribute('data-pafe-form-builder-nav');
      var activeStep = steps[current];
      if (dir === 'next') {
        var required = activeStep.querySelectorAll('[required]');
        for (var i = 0; i < required.length; i++) {
          if (!required[i].value.trim()) {
            required[i].focus();
            return;
          }
        }
        if (current < steps.length - 1) showStep(current + 1);
      } else if (dir === 'prev' && current > 0) {
        showStep(current - 1);
      }
    });

    form.addEventListener('click', function (e) {
      var submitBtn = e.target.closest('[data-pafe-form-builder-submit-form-id]');
      if (!submitBtn) return;
      e.preventDefault();
      var data = collectFields(form);
      if (!data.tel && !data.email12133 && !data.field_f84371f) {
        showMessage(form, 'danger', 'Укажите телефон');
        return;
      }
      submitBtn.disabled = true;
      submitForm(data, 'multistep').then(function (res) {
        submitBtn.disabled = false;
        if (res.success) {
          showMessage(form, 'success');
          steps.forEach(function (s) { s.style.display = 'none'; });
        } else {
          showMessage(form, 'danger', res.message || 'Ошибка отправки');
        }
      }).catch(function () {
        submitBtn.disabled = false;
        showMessage(form, 'danger', 'Ошибка сети. Попробуйте позже.');
      });
    });
  });

  /* --- Elementor popup forms --- */
  function bindPopupForms(container) {
    container.querySelectorAll('form.elementor-form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var data = collectFields(form);
        var btn = form.querySelector('[type="submit"]');
        if (btn) btn.disabled = true;
        var formType = form.closest('.elementor-4882') ? 'evaluate' : 'callback';
        submitForm(data, formType).then(function (res) {
          if (btn) btn.disabled = false;
          if (res.success) {
            form.innerHTML = '<div class="elementor-message-success is-visible" style="padding:20px;text-align:center;">' +
              (res.message || 'Спасибо! Мы свяжемся с вами.') + '</div>';
            setTimeout(closePopup, 3000);
          }
        }).catch(function () {
          if (btn) btn.disabled = false;
        });
      });
    });
  }

  bindPopupForms(document);

})();
