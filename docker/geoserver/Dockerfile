FROM kartoza/geoserver:2.25.0

# Inject a Tomcat CORS filter into GeoServer's web.xml so browsers can call it directly
RUN set -eux; \
  WEB_XML="/usr/local/tomcat/webapps/geoserver/WEB-INF/web.xml"; \
  if [ ! -f "$WEB_XML" ]; then \
    echo "Unable to locate $WEB_XML inside the GeoServer image" >&2; \
    exit 1; \
  fi; \
  if grep -q 'cross-origin' "$WEB_XML"; then \
    echo "CORS filter already present in $WEB_XML – skipping"; \
  else \
    tmp="$(mktemp)"; \
    awk ' \
      /<\/web-app>/ && !done { \
        print "  <filter>"; \
        print "    <filter-name>cross-origin</filter-name>"; \
        print "    <filter-class>org.apache.catalina.filters.CorsFilter</filter-class>"; \
        print "    <init-param>"; \
        print "      <param-name>cors.allowed.origins</param-name>"; \
        print "      <param-value>*</param-value>"; \
        print "    </init-param>"; \
        print "    <init-param>"; \
        print "      <param-name>cors.allowed.methods</param-name>"; \
        print "      <param-value>GET,POST,PUT,DELETE,HEAD,OPTIONS</param-value>"; \
        print "    </init-param>"; \
        print "    <init-param>"; \
        print "      <param-name>cors.allowed.headers</param-name>"; \
        print "      <param-value>*</param-value>"; \
        print "    </init-param>"; \
        print "  </filter>"; \
        print "  <filter-mapping>"; \
        print "    <filter-name>cross-origin</filter-name>"; \
        print "    <url-pattern>/*</url-pattern>"; \
        print "  </filter-mapping>"; \
        done=1; \
      } \
      { print; }' "$WEB_XML" > "$tmp"; \
    cat "$tmp" > "$WEB_XML"; \
    rm "$tmp"; \
  fi
