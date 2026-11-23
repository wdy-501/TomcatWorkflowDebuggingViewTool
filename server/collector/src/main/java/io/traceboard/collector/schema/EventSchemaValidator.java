package io.traceboard.collector.schema;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import com.networknt.schema.uri.URIFactory;

/**
 * Loads the frozen event schema from the classpath once at startup.
 *
 * <p>The schema is single-sourced: {@code maven-resources-plugin} copies
 * {@code schema/traceboard.event.v1.json} (repo root) to {@code target/classes/schema/}
 * during the build. There is intentionally no copy under {@code src/main/resources}.</p>
 *
 * <p>Missing or unreadable schema fails application startup (no silent degradation).</p>
 *
 * <p>Note: the frozen schema uses the opaque URN {@code $id} {@code urn:traceboard:schema:event:v1}.
 * json-schema-validator 1.0.87's default URI factory throws on multi-segment URN ids, so a plain
 * {@link URI}-based factory is registered for the {@code urn} scheme. The schema document itself is
 * used verbatim (no field removed, no second schema) and contains no {@code $ref}, so id handling
 * only affects the base URI.</p>
 */
@Component
public class EventSchemaValidator {

    static final String RESOURCE = "/schema/traceboard.event.v1.json";

    private final JsonSchema schema;

    public EventSchemaValidator(ObjectMapper objectMapper) {
        try (InputStream in = EventSchemaValidator.class.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException(
                        "frozen schema is missing from the classpath: " + RESOURCE
                                + " (expected a build-time copy of schema/traceboard.event.v1.json)");
            }
            JsonNode schemaNode = objectMapper.readTree(in);
            JsonSchemaFactory factory = JsonSchemaFactory
                    .builder(JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012))
                    .uriFactory(UrnUriFactory.INSTANCE, "urn")
                    .build();
            this.schema = factory.getSchema(schemaNode);
        } catch (IOException e) {
            throw new IllegalStateException("failed to load the frozen event schema from " + RESOURCE, e);
        }
    }

    /**
     * @return violations, empty when the event matches the frozen schema
     */
    public Set<ValidationMessage> validate(JsonNode event) {
        return schema.validate(event);
    }

    /**
     * Minimal URI factory for the {@code urn} scheme (opaque URIs are handled by {@link URI}).
     */
    enum UrnUriFactory implements URIFactory {
        INSTANCE;

        @Override
        public URI create(String uri) {
            return URI.create(uri);
        }

        @Override
        public URI create(URI base, String extension) {
            URI id = URI.create(extension);
            if (id.isAbsolute() || base == null) {
                return id;
            }
            return base.resolve(id);
        }
    }
}
