document.addEventListener('DOMContentLoaded', function() {
  const images = document.querySelectorAll('.click-zoom img');

  images.forEach((img) => {
      const initialWidth = img.getAttribute('width') || '30%';
      img.style.width = initialWidth;

      const expand = img.getAttribute('data-expand') || '80%';

      img.addEventListener('click', function() {
          images.forEach((otherImg) => {
              if (otherImg !== img && otherImg.classList.contains('expanded')) {
                  otherImg.style.width = otherImg.getAttribute('width') || '30%';
                  otherImg.classList.remove('expanded');
              }
          });
          
          if (this.classList.contains('expanded')) {
              this.style.width = initialWidth;
              this.classList.remove('expanded');
          } else {
              this.style.width = expand;
              this.classList.add('expanded');
          }
      });
  });
});
